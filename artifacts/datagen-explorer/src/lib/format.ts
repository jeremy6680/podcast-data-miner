import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function formatRelativeDateFR(dateStr: string) {
  try {
    return formatDistanceToNow(new Date(dateStr), { locale: fr, addSuffix: true });
  } catch (e) {
    return dateStr;
  }
}

export function formatDateFR(dateStr: string) {
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: fr });
  } catch (e) {
    return dateStr;
  }
}

export function formatDurationFromSeconds(seconds: number) {
  if (!seconds) return "0 min";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  return `${minutes} min`;
}

export function formatDurationToTimecode(seconds: number) {
  if (!seconds) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
