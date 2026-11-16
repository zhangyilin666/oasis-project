"""Synthetic report claims: reject incorrect data before publishing a report."""
import copy
import json

import pytest

from app.services.calendar_service import calculate_bazi, calculate_dayun
from app.services.report_integrity import report_facts, verified_executor
from app.services.workflow_service import StepConfig, StepExecutor
from app.services import background_analysis
from tests.test_mobile_flow import PAYLOAD, wait_report


@pytest.fixture
def facts():
    return report_facts(calculate_bazi('1990-06-15', '08:30'),
                        calculate_dayun('1990-06-15', '08:30', '男'))


def execute(facts, payload, refs=None):
    executor = verified_executor(StepExecutor(lambda step, data: {
        'analysis': json.dumps(payload, ensure_ascii=False), 'usage': {'output_tokens': 20}
    }), facts, refs or [])
    return executor.execute(StepConfig(name='ai_analysis', prompt_template='解读'), {})


def test_valid_claims_preserve_text_and_usage(facts):
    result = execute(facts, {'text': '日柱：' + facts['pillars']['day'],
                            'facts': facts, 'reference_ids': ['note:p1']}, [{'id': 'note:p1'}])
    assert result.status == 'success'
    assert result.output['usage']['output_tokens'] == 20
    assert result.output['verification']['reference_ids'] == ['note:p1']
    assert not result.output['analysis'].startswith('{')


def test_extra_envelope_metadata_is_ignored_but_not_persisted(facts):
    result = execute(facts, {'type': 'json_object', 'text': '文化解释',
                            'facts': facts, 'reference_ids': []})
    assert result.status == 'success'
    assert 'type' not in result.output
    assert result.output['analysis'] == '文化解释'


@pytest.mark.parametrize('mutation', ['pillar', 'count', 'boolean', 'luck', 'missing', 'unknown_source', 'empty_text', 'prose', 'heading'])
def test_wrong_or_missing_claims_fail_closed(facts, mutation):
    payload = {'text': '文化解释', 'facts': copy.deepcopy(facts), 'reference_ids': []}
    if mutation == 'pillar': payload['facts']['pillars']['day'] = '甲子?'
    elif mutation == 'count': payload['facts']['elements']['金'] += 1
    elif mutation == 'boolean': payload['facts']['elements']['金'] = True
    elif mutation == 'luck': payload['facts']['dayun'][0]['start_year'] += 1
    elif mutation == 'missing': del payload['facts']['day_master']
    elif mutation == 'unknown_source': payload['reference_ids'] = ['invented']
    elif mutation == 'empty_text': payload['text'] = ' '
    elif mutation == 'prose': payload['text'] = '日柱：' + ('乙丑' if facts['pillars']['day'] == '甲子' else '甲子')
    elif mutation == 'heading': payload['text'] = '第一步大运（甲子，999-1000岁）：文化解读'
    assert execute(facts, payload).status == 'error'


@pytest.mark.parametrize('raw', ['not json', '[]', 'null', '{}'])
def test_malformed_ai_output_rejected(facts, raw):
    executor = verified_executor(StepExecutor(lambda step, data: {'analysis': raw}), facts, [])
    assert executor.execute(StepConfig(name='ai_analysis', prompt_template='解读'), {}).status == 'error'


def test_report_persists_verified_sources_and_rejects_bad_report(client, fresh_user, monkeypatch):
    def provider(step, data):
        facts = json.loads(data['integrity_facts'])
        ids = json.loads(data['integrity_sources'])
        return {'analysis': json.dumps({'text': '日柱：' + facts['pillars']['day'],
            'facts': facts, 'reference_ids': ids[:1]}, ensure_ascii=False), 'model': 'fake'}
    monkeypatch.setattr(background_analysis, '_resolve_ai_backend', lambda: (StepExecutor(provider), 'fake'))
    response = client.post('/api/v1/app/oasis/analyze', json=PAYLOAD, headers=fresh_user['headers'])
    report = wait_report(client, fresh_user['headers'], response.json()['data']['report_id'])
    assert report['status'] == 'completed'
    data = report['calendar_data']
    assert data['verification']['status'] == 'structured_checked'
    assert data['references']
    for reference in data['references']:
        assert reference['kind'].startswith('项目学习笔记')
        assert reference['sha256'] and reference['paragraph'] > 0
        assert 'source_file' not in reference
    # A malformed successful provider response must not become a completed report.
    monkeypatch.setattr(background_analysis, '_resolve_ai_backend', lambda: (
        StepExecutor(lambda step, data: {'analysis': 'unchecked plain prose'}), 'fake'))
    response = client.post('/api/v1/app/oasis/analyze', json=PAYLOAD, headers=fresh_user['headers'])
    failed = wait_report(client, fresh_user['headers'], response.json()['data']['report_id'])
    assert failed['status'] == 'failed'
    assert not failed['calendar_data']
    assert failed['can_retry']


def test_mock_report_is_not_marked_verified(client, fresh_user):
    from tests.conftest import create_analysis
    report = create_analysis(client, fresh_user['headers'])
    assert report['calendar_data']['verification']['status'] == 'not_checked'


def test_source_metadata_identifies_paragraph_and_content_revision(tmp_path):
    from app.services.rag_service import KnowledgeBase
    path = tmp_path / 'notes.txt'
    path.write_text('学习笔记\n\n五行 木火土金水\n\n五行解释', encoding='utf-8')
    kb = KnowledgeBase(tmp_path)
    kb.load_all()
    matches = kb.search('五行')
    assert len({item.metadata['paragraph'] for item in matches}) == 2
    old_hash = matches[0].metadata['sha256']
    path.write_text('学习笔记\n\n五行 木火土金水（更新）', encoding='utf-8')
    revised = KnowledgeBase(tmp_path)
    revised.load_all()
    assert revised.search('五行')[0].metadata['sha256'] != old_hash
    assert matches[0].metadata['sha256'] == old_hash
