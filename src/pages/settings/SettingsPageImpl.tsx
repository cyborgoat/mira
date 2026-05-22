import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, message, Tag, Spin } from 'antd';
import { tauriCommands } from '../../hooks/useTauri';
import { DEFAULT_MODEL } from '../../constants';

const MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5（快速·推荐）' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6（均衡）' },
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7（最强）' },
];

export function SettingsPage() {
  const [form] = Form.useForm();
  const [apiKeySet, setApiKeySet] = useState(false);
  const [currentModel, setCurrentModel] = useState(DEFAULT_MODEL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      tauriCommands.getApiKeySet(),
      tauriCommands.getModel(),
    ]).then(([isSet, model]) => {
      setApiKeySet(isSet);
      setCurrentModel(model);
      form.setFieldsValue({ model });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSave = async (values: { apiKey: string; model: string }) => {
    if (!values.apiKey?.trim()) {
      message.warning('请输入 API Key');
      return;
    }
    setSaving(true);
    try {
      await tauriCommands.setApiKey(values.apiKey.trim(), values.model);
      setApiKeySet(true);
      setCurrentModel(values.model);
      form.setFieldValue('apiKey', '');
      message.success('设置已保存');
    } catch (e: any) {
      message.error(e?.toString() || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin />;

  return (
    <div>
      <div className="page-header-card">
        <h3>⚙️ 设置</h3>
        <p className="subtitle">配置 AI 功能所需的 API Key 与模型</p>
      </div>

      <div className="mira-card settings-form">
        <div className="mira-card-title">AI 配置</div>

        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 13 }}>API Key 状态：</span>
          {apiKeySet ? (
            <Tag color="success">已配置</Tag>
          ) : (
            <Tag color="error">未配置</Tag>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 13 }}>当前模型：</span>
          <Tag color="blue">{MODELS.find((m) => m.value === currentModel)?.label || currentModel}</Tag>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ model: DEFAULT_MODEL }}>
          <Form.Item
            name="apiKey"
            label="Anthropic API Key"
            extra={apiKeySet ? '已有 Key，输入新 Key 可覆盖' : '在 console.anthropic.com 获取'}
          >
            <Input.Password placeholder="sk-ant-..." />
          </Form.Item>

          <Form.Item name="model" label="AI 模型">
            <Select>
              {MODELS.map((m) => (
                <Select.Option key={m.value} value={m.value}>{m.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
