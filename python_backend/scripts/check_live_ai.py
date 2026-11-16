"""Opt-in live API acceptance check using fictional data and a temporary DB.

Run from python_backend: python scripts/check_live_ai.py --execute-live --output FILE
Uses the configured provider and makes at most three report calls and one daily
call. No credentials, tokens or device recovery codes are written to the output.
"""
import argparse
import json
import logging
import os
from pathlib import Path
import sys
import tempfile
import time
import uuid
import traceback
from datetime import datetime, timezone


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute-live', action='store_true')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    os.chdir(root)
    sys.path.insert(0, str(root))
    # Must override before importing settings/database. Keep the configured API.
    with tempfile.TemporaryDirectory(prefix='oasis-live-ai-') as temporary:
        os.environ['DATABASE_URL'] = 'sqlite:///' + (Path(temporary) / 'check.db').as_posix()
        os.environ['JWT_SECRET_KEY'] = uuid.uuid4().hex + uuid.uuid4().hex
        os.environ['ALLOW_MOCK_AI'] = 'false'
        os.environ['KNOWLEDGE_DIR'] = str(root.parent / 'data_center' / 'knowledge')
        os.environ['WECHAT_APPID'] = ''
        os.environ['WECHAT_SECRET'] = ''
        logging.disable(logging.CRITICAL)
        from app.core.config import settings
        provider = settings.AI_PROVIDER.strip().lower()
        key = settings.DEEPSEEK_API_KEY if provider == 'deepseek' else settings.ANTHROPIC_API_KEY if provider == 'anthropic' else ''
        if not key or not args.execute_live:
            print(json.dumps({'ready': bool(key), 'live_execution_requested': args.execute_live}))
            return 2

        from fastapi.testclient import TestClient
        from app.main import app
        from app.db.base import Base
        from app.db.database import engine
        from app import models  # noqa: F401
        from app.services import background_analysis, daily_fortune_service
        from app.services.analysis_service import _resolve_ai_backend

        summary = {'started_at': datetime.now(timezone.utc).isoformat(),
                   'provider': provider, 'synthetic_data': True, 'calls': [], 'passed': False}
        started = time.perf_counter()

        def install_measurement(client, label):
            endpoint = client.chat.completions if provider == 'deepseek' else client.messages
            original = endpoint.create

            def measured(**kwargs):
                before = time.perf_counter()
                record = {'step': label, 'requested_model': kwargs['model']}
                try:
                    response = original(**kwargs)
                    record.update({'ok': True, 'returned_model': getattr(response, 'model', None),
                                   'usage': response.usage.model_dump() if response.usage else {}})
                    if provider == 'deepseek':
                        record['response_text'] = response.choices[0].message.content
                    return response
                except Exception as exc:
                    record.update({'ok': False, 'error_type': type(exc).__name__,
                                   'http_status': getattr(exc, 'status_code', None)})
                    raise
                finally:
                    record['seconds'] = round(time.perf_counter() - before, 2)
                    summary['calls'].append(record)
                    print(json.dumps({k: v for k, v in record.items() if k != 'response_text'}, ensure_ascii=False), flush=True)

            endpoint.create = measured

        try:
            executor, model = _resolve_ai_backend()
            # Instrument the actual SDK request without changing prompts/responses.
            client = executor._callable.__self__._client
            install_measurement(client, 'report')
            background_analysis._resolve_ai_backend = lambda: (executor, model)
            daily_client = (daily_fortune_service._get_deepseek_client() if provider == 'deepseek'
                            else daily_fortune_service._get_anthropic_client())
            install_measurement(daily_client, 'daily_fortune')
            Base.metadata.create_all(engine)
            with TestClient(app) as browser:
                login = browser.post('/api/v1/app/anonymous-login', json={'device_id': 'live-check-' + uuid.uuid4().hex})
                login.raise_for_status()
                headers = {'Authorization': 'Bearer ' + login.json()['data']['token']}
                response = browser.post('/api/v1/app/oasis/analyze', headers=headers, json={
                    'name': '虚构联调样例', 'birth_date': '1990-06-15', 'birth_time': '08:30',
                    'gender': '男', 'location': '北京', 'is_solar_time': True})
                response.raise_for_status()
                report_id = response.json()['data']['report_id']
                for _ in range(480):
                    response = browser.get(f'/api/v1/app/oasis/report/{report_id}', headers=headers)
                    response.raise_for_status()
                    report = response.json()['data']
                    if report['status'] in ('completed', 'failed'):
                        break
                    time.sleep(1)
                summary['report_status'] = report['status']
                summary['report_seconds'] = round(time.perf_counter() - started, 2)
                if report['status'] != 'completed':
                    # Store only known validation messages, never raw provider errors.
                    summary['failure_stage'] = 'report'
                    return 1
                data = report['calendar_data']
                summary['verification'] = data.get('verification')
                summary['references'] = data.get('references', [])
                summary['analysis'] = report['ai_analysis']
                summary['suggestion'] = data.get('suggestion')
                summary['dayun_summary'] = data.get('yun_summary')
                if data.get('verification', {}).get('status') != 'structured_checked':
                    raise RuntimeError('Unverified report')
                daily = browser.get('/api/v1/app/oasis/daily-fortune', headers=headers, params={'report_id': report_id})
                daily.raise_for_status()
                summary['daily'] = daily.json()['data']
                calls_before_cache = len(summary['calls'])
                cached = browser.get('/api/v1/app/oasis/daily-fortune', headers=headers, params={'report_id': report_id})
                cached.raise_for_status()
                summary['cache_reused'] = cached.json()['data']['is_cached'] and len(summary['calls']) == calls_before_cache
                summary['passed'] = bool(summary['cache_reused'])
                return 0 if summary['passed'] else 1
        except Exception as exc:
            summary['error_type'] = type(exc).__name__
            summary['error_frames'] = [{'file': Path(frame.filename).name, 'line': frame.lineno,
                                        'function': frame.name} for frame in traceback.extract_tb(exc.__traceback__)]
            return 1
        finally:
            engine.dispose()
            summary['total_seconds'] = round(time.perf_counter() - started, 2)
            if summary['passed']:
                # The report above already contains the reviewed text; avoid duplication.
                for record in summary['calls']:
                    record.pop('response_text', None)
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
            print(json.dumps({'passed': summary['passed'], 'report_status': summary.get('report_status'),
                              'output': str(args.output), 'seconds': summary['total_seconds']}), flush=True)


if __name__ == '__main__':
    raise SystemExit(main())
