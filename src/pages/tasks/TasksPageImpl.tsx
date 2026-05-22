import React, { useState } from 'react';
import { Row, Col, Button, Modal, Form, Input, Select, notification, Popconfirm, Empty, Tag, Checkbox } from 'antd';
import dayjs from 'dayjs';
import { useStore, useActions } from '../../store/context';
import type { Task } from '../../types';
import { PROJECTS, PRIORITIES } from '../../constants';

const { TextArea } = Input;

interface TaskFormValues {
  title: string;
  detail?: string;
  projectId: string;
  priority: Task['priority'];
  dueDate: string;
}

function TaskModal({
  open,
  task,
  onClose,
}: {
  open: boolean;
  task: Task | null;
  onClose: () => void;
}) {
  const { addTask, updateTask } = useActions();
  const [form] = Form.useForm<TaskFormValues>();

  const handleOk = () => {
    form.validateFields().then((values) => {
      if (task) {
        updateTask(task.id, values);
        import('antd').then(({ message }) => message.success('任务已更新'));
      } else {
        addTask(values);
        import('antd').then(({ message }) => message.success('任务已创建'));
      }
      onClose();
    });
  };

  return (
    <Modal
      open={open}
      title={task ? '编辑任务' : '新建任务'}
      onOk={handleOk}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      destroyOnClose
      afterOpenChange={(vis) => {
        if (vis) {
          form.setFieldsValue(
            task
              ? { ...task }
              : {
                  priority: 'normal',
                  dueDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
                  projectId: PROJECTS[0].id,
                }
          );
        }
      }}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="任务标题" />
        </Form.Item>
        <Form.Item name="detail" label="详情">
          <TextArea rows={3} placeholder="详细描述（可选）" />
        </Form.Item>
        <Form.Item name="projectId" label="所属项目" rules={[{ required: true }]}>
          <Select>
            {PROJECTS.map((p) => (
              <Select.Option key={p.id} value={p.id}>
                {p.icon} {p.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="priority" label="优先级">
              <Select style={{ width: 120 }}>
                {PRIORITIES.map((p) => (
                  <Select.Option key={p.value} value={p.value}>
                    {p.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="dueDate" label="截止日期">
              <Input type="date" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}

function TaskItem({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { updateTask, removeTask } = useActions();
  const project = PROJECTS.find((p) => p.id === task.projectId);
  const priority = PRIORITIES.find((p) => p.value === task.priority);

  const handleDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateTask(task.id, { done: true });
    notification.success({
      message: '✅ 已完成',
      description: `「${task.title}」已归档`,
      placement: 'bottomRight',
      duration: 2,
    });
  };

  return (
    <div className="task-item" onClick={() => onEdit(task)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Checkbox checked={task.done} onClick={(e) => e.stopPropagation()} onChange={() => handleDone({ stopPropagation: () => {} } as any)} />
        <div style={{ flex: 1 }}>
          <div className="task-title" style={{ fontWeight: 500, marginBottom: 4 }}>
            {task.title}
          </div>
          {task.detail && (
            <div style={{ fontSize: 12, color: 'var(--mira-text-muted)', marginBottom: 6 }}>
              {task.detail}
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {project && (
              <Tag color="purple" style={{ fontSize: 11 }}>
                {project.icon} {project.name.slice(0, 6)}
              </Tag>
            )}
            {priority && (
              <Tag color={priority.color as any} style={{ fontSize: 11 }}>
                {priority.label}
              </Tag>
            )}
            {task.tags.slice(0, 2).map((tag) => (
              <Tag key={tag} color="gold" style={{ fontSize: 11 }}>
                {tag}
              </Tag>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <Button size="small" type="primary" onClick={handleDone}>
            完成
          </Button>
          <Popconfirm
            title="确认删除？"
            onConfirm={() => removeTask(task.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button size="small" type="text" danger>
              删除
            </Button>
          </Popconfirm>
        </div>
      </div>
    </div>
  );
}

export function TasksPage() {
  const { state } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const todos = state.tasks.filter((t) => !t.done).sort((a, b) => b.createdAt - a.createdAt);
  const archived = state.tasks.filter((t) => t.done).sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));

  const openEdit = (task: Task) => {
    setEditTask(task);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditTask(null);
    setModalOpen(true);
  };

  return (
    <div>
      {/* Top card */}
      <div className="page-header-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>✅ 随手记</h3>
            <p className="subtitle">
              待办 <strong style={{ color: '#fff' }}>{todos.length}</strong> 项 · 已完成{' '}
              <strong style={{ color: '#fff' }}>{archived.length}</strong> 项
            </p>
          </div>
          <Button type="primary" onClick={openCreate} style={{ background: 'var(--mira-gold)', borderColor: 'var(--mira-gold)', color: 'var(--mira-primary)' }}>
            + 新建任务
          </Button>
        </div>
        <div className="watermark">✅</div>
      </div>

      <Row gutter={20}>
        {/* Todo list */}
        <Col span={15}>
          <div className="mira-card" style={{ margin: 0 }}>
            <div className="mira-card-title">待办事项</div>
            {todos.length === 0 ? (
              <Empty description="暂无待办" />
            ) : (
              todos.map((task) => (
                <TaskItem key={task.id} task={task} onEdit={openEdit} />
              ))
            )}
          </div>
        </Col>

        {/* Archived list */}
        <Col span={9}>
          <div className="mira-card" style={{ margin: 0 }}>
            <div className="mira-card-title">已归档</div>
            <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
              {archived.length === 0 ? (
                <Empty description="暂无已完成事项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                archived.map((task) => {
                  const project = PROJECTS.find((p) => p.id === task.projectId);
                  return (
                    <div key={task.id} className="archived-item">
                      <span>{project?.icon}</span>
                      <span className="archived-title">{task.title}</span>
                      <span style={{ fontSize: 11, color: 'var(--mira-text-muted)', flexShrink: 0 }}>
                        {task.finishedAt ? dayjs(task.finishedAt).format('MM/DD') : ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Col>
      </Row>

      <TaskModal
        open={modalOpen}
        task={editTask}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
