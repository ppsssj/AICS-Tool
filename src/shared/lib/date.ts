import type { Weekday } from '@/entities/models';

export const weekdays: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function parseDateValue(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(parseDateValue(dateString));
}

export function formatShortDate(dateString: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(parseDateValue(dateString));
}

export function formatDateTime(dateString: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(parseDateValue(dateString));
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfWeek(date: Date): Date {
  const normalizedDayIndex = (date.getDay() + 6) % 7;
  return addDays(startOfDay(date), -normalizedDayIndex);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

export function addWeeks(date: Date, amount: number): Date {
  return addDays(date, amount * 7);
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function isSameMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWeekdayFromDate(date: Date): Weekday {
  return weekdays[(date.getDay() + 6) % 7];
}

export function getMonthGrid(date: Date): Date[] {
  const firstDay = startOfMonth(date);
  const leadingDayCount = (firstDay.getDay() + 6) % 7;
  const gridStart = addDays(firstDay, -leadingDayCount);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(date);
}

export function compareWeekday(a: Weekday, b: Weekday): number {
  return weekdays.indexOf(a) - weekdays.indexOf(b);
}
