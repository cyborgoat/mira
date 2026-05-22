import type { Project, TeamMember } from '../types';

export const PROJECTS: Project[] = [
  { id: 'p1', name: '某国有大行数字化转型咨询', color: '#1B2A4E', icon: '🏦' },
  { id: 'p2', name: '某股份制银行智能风控项目', color: '#E8B86D', icon: '🛡️' },
  { id: 'p3', name: '某城商行运营效能提升', color: '#52C41A', icon: '📈' },
  { id: 'p4', name: '某农商行客户旅程优化', color: '#722ED1', icon: '🗺️' },
  { id: 'p5', name: '某外资银行合规咨询', color: '#FA541C', icon: '📋' },
];

export const TEAM_MEMBERS: TeamMember[] = [
  { id: 'm1', name: '陈思远', role: '高级顾问', avatar: '🧑‍💼', color: '#1B2A4E' },
  { id: 'm2', name: '林晓彤', role: '咨询顾问', avatar: '👩‍💼', color: '#E8B86D' },
  { id: 'm3', name: '王嘉琪', role: '咨询顾问', avatar: '👨‍💻', color: '#52C41A' },
  { id: 'm4', name: '赵明轩', role: '初级顾问', avatar: '🧑‍🎓', color: '#722ED1' },
  { id: 'm5', name: '孙艺涵', role: '高级顾问', avatar: '👩‍🔬', color: '#FA541C' },
  { id: 'm6', name: '周文博', role: '项目经理', avatar: '🧑‍🔧', color: '#13C2C2' },
];

export const KEYWORD_DICT: string[] = [
  '需求调研', '方案设计', '客户汇报', '投标', '标书编写', '项目立项',
  '里程碑评审', '交付物编写', '数据分析', '流程梳理', '组织诊断',
  '运营指标设计', 'KPI体系搭建', '竞品分析', '合规审查', '风险识别',
  '培训赋能', '知识转移', '变更管理', '干系人沟通', '项目复盘',
  '质量检查', '资源协调', '商务谈判', '合同签署', 'SOP制定',
  '系统对接', 'UAT测试', '上线支持',
];

export const PRIORITIES = [
  { value: 'low', label: '低', color: 'default' },
  { value: 'normal', label: '普通', color: 'blue' },
  { value: 'high', label: '高', color: 'orange' },
  { value: 'urgent', label: '紧急', color: 'red' },
] as const;

export const TAG_TYPES: string[] = [
  '需求分析', '方案交付', '客户沟通', '项目管理', '投标商务',
  '数据分析', '运营优化', '合规风控', '培训赋能', '系统实施',
];

export const MENU_ITEMS = [
  { key: 'tasks', label: '随手记', icon: '✅' },
  { key: 'report', label: '写总结', icon: '📝' },
  { key: 'wiki', label: '工作库', icon: '📚' },
  { key: 'ask', label: '问Mira', icon: '🪞' },
  { key: 'talent', label: '人才库', icon: '👥', managementOnly: true },
  { key: 'settings', label: '设置', icon: '⚙️' },
];

export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
