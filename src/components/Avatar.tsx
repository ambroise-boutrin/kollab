import type { Member } from '../lib/types'

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase()
}

export function Avatar({ member, size = 32, online = false }: { member: Member | undefined; size?: number; online?: boolean }) {
  if (!member) return null
  return (
    <span
      className={`avatar${online ? ' online' : ''}`}
      style={{ width: size, height: size, background: member.color, fontSize: Math.round(size * 0.38) }}
      title={member.name}
    >
      {initials(member.name)}
    </span>
  )
}
