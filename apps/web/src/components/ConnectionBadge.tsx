import type { ConnectionStatus } from '@bluff-tavern/shared';

const label: Record<ConnectionStatus, string> = {
  connected: 'Server Connected', connecting: '正在连接', disconnected: '连接断开',
};

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return <div className={`connection connection--${status}`} role="status"><span />{label[status]}</div>;
}
