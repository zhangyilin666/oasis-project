"""Request contracts for the currently deployed DeepSeek model."""
from types import SimpleNamespace

from app.services import deepseek_client, daily_fortune_service
from app.services.calendar_service import DailyFortuneData
from app.services.workflow_service import StepConfig


def fake_client(calls, content='{"text":"example"}'):
    def create(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(finish_reason='stop',
            message=SimpleNamespace(content=content))], usage=None)
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


def test_structured_report_requests_json_without_thinking(monkeypatch):
    calls = []
    monkeypatch.setattr(deepseek_client, 'OpenAI', lambda **kwargs: fake_client(calls))
    client = deepseek_client.DeepSeekClient(api_key='synthetic', default_model='deepseek-flash')
    step = StepConfig(name='ai_analysis', model='deepseek-flash', prompt_template='JSON', output_schema={'type': 'object'})
    client.call(step, {})
    assert calls[0]['response_format'] == {'type': 'json_object'}
    assert calls[0]['extra_body'] == {'thinking': {'type': 'disabled'}}


def test_other_compatible_models_do_not_receive_deepseek_thinking_flag(monkeypatch):
    calls = []
    monkeypatch.setattr(deepseek_client, 'OpenAI', lambda **kwargs: fake_client(calls, 'text'))
    client = deepseek_client.DeepSeekClient(api_key='synthetic')
    client.call(StepConfig(name='custom', model='custom-model', prompt_template='text'), {})
    assert 'extra_body' not in calls[0]
    assert 'response_format' not in calls[0]


def test_daily_uses_same_json_mode_and_model(monkeypatch):
    calls = []
    monkeypatch.setattr(daily_fortune_service.settings, 'DEEPSEEK_DEFAULT_MODEL', 'deepseek-flash')
    monkeypatch.setattr(daily_fortune_service, '_get_deepseek_client', lambda: fake_client(calls, '{"fortune_text":"放慢脚步"}'))
    result = daily_fortune_service._call_deepseek_api(DailyFortuneData())
    assert result['fortune_text'] == '放慢脚步'
    assert calls[0]['model'] == 'deepseek-flash'
    assert calls[0]['max_tokens'] == 1024
    assert calls[0]['response_format'] == {'type': 'json_object'}
    assert calls[0]['extra_body']['thinking']['type'] == 'disabled'
    prompt = calls[0]['messages'][0]['content']
    assert '6 到 8 句话' in prompt
    assert '250 到 400 个汉字' in prompt
    assert '第一段讲今天对你意味着什么' in prompt
    assert '第二段讲今天可以怎么做' in prompt
    assert '200字以内' not in prompt
    assert '3-5句话' not in prompt
