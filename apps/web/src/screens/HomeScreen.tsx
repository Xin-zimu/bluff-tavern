import { useState, type FormEvent } from 'react';

interface Props {
  busy: boolean;
  onCreate: (nickname: string) => void;
  onJoin: (nickname: string, roomCode: string) => void;
}

export function HomeScreen({ busy, onCreate, onJoin }: Props) {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const submitJoin = (event: FormEvent) => { event.preventDefault(); onJoin(nickname, roomCode); };
  return <main className="home">
    <section className="hero" aria-labelledby="game-title">
      <div className="emblem" aria-hidden="true"><span>♠</span></div>
      <p className="eyebrow">BLUFF TAVERN</p>
      <h1 id="game-title">诡牌酒馆</h1>
      <p className="tagline">推开暗门，找张椅子。今晚先从聚齐牌友开始。</p>
    </section>
    <section className="panel entry-panel">
      <label htmlFor="nickname">酒馆称呼</label>
      <input id="nickname" maxLength={16} autoComplete="nickname" value={nickname}
        onChange={(e) => setNickname(e.target.value)} placeholder="输入 1–16 字昵称" />
      <button className="button button--primary" disabled={busy || !nickname.trim()} onClick={() => onCreate(nickname)}>
        创建房间
      </button>
      <div className="divider"><span>或凭房间码入席</span></div>
      <form onSubmit={submitJoin}>
        <label htmlFor="room-code">6 位房间码</label>
        <input id="room-code" className="code-input" maxLength={6} autoCapitalize="characters" value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="例如 7K3M9X" />
        <button className="button button--secondary" disabled={busy || !nickname.trim() || roomCode.length !== 6}>加入房间</button>
      </form>
    </section>
  </main>;
}
