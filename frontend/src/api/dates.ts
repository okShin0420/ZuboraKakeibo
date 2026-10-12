export function todayInTokyo(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}
