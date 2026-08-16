import type { ConnectionStatus } from '@bluff-tavern/shared';

const label: Record<ConnectionStatus, string> = {
  connected: 'Server Connected', connecting: '正在连接', disconnected: '连接断开',
};

export function ConnectionBadge({ status, networkOnline }: { status: ConnectionStatus; networkOnline: boolean }) {
  const visibleStatus = networkOnline ? status : 'disconnected';
  return <div className={`connection connection--${visibleStatus}`} role="status"><span />{networkOnline ? label[status] : '设备离线'}</div>;
}
