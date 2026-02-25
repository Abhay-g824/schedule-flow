/**
 * Parses natural language input to extract task title, date, and time
 * Examples:
 * - "today class at 10 am" -> { title: "class", date: today, time: "10:00" }
 * - "tomorrow meeting at 2pm" -> { title: "meeting", date: tomorrow, time: "14:00" }
 * - "next week presentation" -> { title: "presentation", date: next week }
 */

interface ParsedTask {
  title: string;
  date?: Date;
  time?: string;
  priority?: 'high' | 'medium' | 'low';
}

export function parseNaturalLanguage(input: string): ParsedTask {
  const normalized = input.toLowerCase().trim();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let title = input;
  let date: Date | undefined;
  let time: string | undefined;
  let priority: 'high' | 'medium' | 'low' | undefined;

  // Extract time patterns (e.g., "10 am", "2pm", "14:30", "3:45 pm", "at 10 am")
  // Check for "at X" pattern first, then general time patterns
  const atTimeMatch = normalized.match(/at\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)?/gi);
  if (atTimeMatch) {
    const timeStr = atTimeMatch[0];
    time = parseTime(timeStr);
    // Remove time from title
    title = title.replace(new RegExp(timeStr, 'gi'), '').trim();
    title = title.replace(/\s*at\s*$/gi, '').trim();
  } else {
    // Check for general time patterns
    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm)?/gi, // "10:30 am", "14:30"
      /(\d{1,2})\s*(am|pm)/gi, // "10 am", "2pm"
    ];

    for (const pattern of timePatterns) {
      const match = normalized.match(pattern);
      if (match) {
        const timeStr = match[0];
        time = parseTime(timeStr);
        // Remove time from title
        title = title.replace(new RegExp(timeStr, 'gi'), '').trim();
        break;
      }
    }
  }

  // Extract date patterns - check in order of specificity
  // First check for absolute dates (e.g., "12 dec", "12 december", "dec 12", "on 12 dec")
  const absoluteDate = parseAbsoluteDate(normalized, today);
  if (absoluteDate) {
    date = absoluteDate.date;
    // Remove the date match (the regex already handles "on" prefix)
    const datePattern = new RegExp(`(?:on\\s+)?${absoluteDate.matchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
    title = title.replace(datePattern, '').trim();
  } else if (normalized.includes('day after tomorrow')) {
    // Check for specific phrases
    date = new Date(today);
    date.setDate(date.getDate() + 2);
    title = title.replace(/day after tomorrow/gi, '').trim();
  } else if (normalized.includes('tomorrow')) {
    date = new Date(today);
    date.setDate(date.getDate() + 1);
    title = title.replace(/tomorrow/gi, '').trim();
  } else if (normalized.includes('today')) {
    date = new Date(today);
    title = title.replace(/today/gi, '').trim();
  } else if (normalized.includes('next week')) {
    date = new Date(today);
    date.setDate(date.getDate() + 7);
    title = title.replace(/next week/gi, '').trim();
  } else if (normalized.includes('next month')) {
    date = new Date(today);
    date.setMonth(date.getMonth() + 1);
    title = title.replace(/next month/gi, '').trim();
  } else {
    // Check for day names
    const dayMatch = normalized.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi);
    if (dayMatch) {
      const daysOffset = getDayOffset(dayMatch[0], normalized);
      date = new Date(today);
      date.setDate(date.getDate() + daysOffset);
      title = title.replace(new RegExp(dayMatch[0], 'gi'), '').trim();
    } else {
      // Check for "X days" pattern
      const daysMatch = normalized.match(/(\d+)\s*days?\s*(from now|later)?/gi);
      if (daysMatch) {
        const daysOffset = getDaysOffset(daysMatch[0], normalized);
        if (daysOffset !== null) {
          date = new Date(today);
          date.setDate(date.getDate() + daysOffset);
          title = title.replace(new RegExp(daysMatch[0], 'gi'), '').trim();
        }
      }
    }
  }

  // If date was found and time is set, apply time to the date
  if (date && time) {
    const [hours, minutes] = time.split(':').map(Number);
    date.setHours(hours, minutes || 0, 0, 0);
  }

  // Extract priority keywords
  if (/\b(urgent|important|asap|critical)\b/gi.test(normalized)) {
    priority = 'high';
    title = title.replace(/\b(urgent|important|asap|critical)\b/gi, '').trim();
  } else if (/\b(low priority|not urgent)\b/gi.test(normalized)) {
    priority = 'low';
    title = title.replace(/\b(low priority|not urgent)\b/gi, '').trim();
  }

  // Clean up title (remove extra spaces, "at", etc.)
  title = title
    .replace(/\s+/g, ' ')
    .replace(/\b(at|on|for|the)\b/gi, '')
    .trim();

  // If no date was found but time was, assume today
  if (!date && time) {
    date = new Date(today);
    const [hours, minutes] = time.split(':').map(Number);
    date.setHours(hours, minutes || 0, 0, 0);
  }

  return {
    title: title || input, // Fallback to original if title is empty
    date,
    time,
    priority,
  };
}

function parseTime(timeStr: string): string {
  const normalized = timeStr.toLowerCase().trim().replace(/^at\s+/, '');
  
  // Handle "10:30 am" or "14:30" format first (more specific)
  const detailedTimeMatch = normalized.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
  if (detailedTimeMatch) {
    let hours = parseInt(detailedTimeMatch[1]);
    const minutes = detailedTimeMatch[2];
    const period = detailedTimeMatch[3];
    
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  
  // Handle "10 am" or "2pm" format
  const simpleTimeMatch = normalized.match(/(\d{1,2})\s*(am|pm)/);
  if (simpleTimeMatch) {
    let hours = parseInt(simpleTimeMatch[1]);
    const period = simpleTimeMatch[2];
    
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, '0')}:00`;
  }
  
  // Handle 24-hour format without am/pm
  const hourOnlyMatch = normalized.match(/^(\d{1,2})$/);
  if (hourOnlyMatch) {
    let hours = parseInt(hourOnlyMatch[1]);
    if (hours >= 0 && hours <= 23) {
      return `${hours.toString().padStart(2, '0')}:00`;
    }
  }
  
  return '';
}

function getDayOffset(dayStr: string, fullText: string): number {
  const dayMap: Record<string, number> = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6,
  };
  
  const targetDay = dayMap[dayStr.toLowerCase()];
  const today = new Date().getDay();
  let daysUntil = targetDay - today;
  
  if (daysUntil <= 0) {
    daysUntil += 7; // Next week
  }
  
  // Check if "next" is mentioned
  if (/\bnext\b/gi.test(fullText)) {
    daysUntil += 7;
  }
  
  return daysUntil;
}

function getDaysOffset(match: string, fullText: string): number | null {
  const numMatch = match.match(/(\d+)/);
  if (numMatch) {
    return parseInt(numMatch[1]);
  }
  return null;
}

function parseAbsoluteDate(normalized: string, today: Date): { date: Date; matchStr: string } | null {
  const monthMap: Record<string, number> = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11,
  };

  // Pattern 1: "on 12 dec" or "12 dec" or "12 december" (day month)
  const pattern1 = normalized.match(/(?:on\s+)?(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/gi);
  if (pattern1) {
    const match = pattern1[0];
    const parts = match.replace(/^on\s+/i, '').trim().split(/\s+/);
    const day = parseInt(parts[0]);
    const monthName = parts[1].toLowerCase();
    const month = monthMap[monthName];
    
    if (month !== undefined && day >= 1 && day <= 31) {
      const year = today.getFullYear();
      const parsedDate = new Date(year, month, day);
      
      // If the date has passed this year, use next year
      if (parsedDate < today) {
        parsedDate.setFullYear(year + 1);
      }
      
      return { date: parsedDate, matchStr: match };
    }
  }

  // Pattern 2: "on dec 12" or "dec 12" or "december 12" (month day)
  const pattern2 = normalized.match(/(?:on\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s+(\d{1,2})\b/gi);
  if (pattern2) {
    const match = pattern2[0];
    const parts = match.replace(/^on\s+/i, '').trim().split(/\s+/);
    const monthName = parts[0].toLowerCase();
    const day = parseInt(parts[1]);
    const month = monthMap[monthName];
    
    if (month !== undefined && day >= 1 && day <= 31) {
      const year = today.getFullYear();
      const parsedDate = new Date(year, month, day);
      
      // If the date has passed this year, use next year
      if (parsedDate < today) {
        parsedDate.setFullYear(year + 1);
      }
      
      return { date: parsedDate, matchStr: match };
    }
  }

  // Pattern 3: "on 12/12" or "12/12" or "12-12" (day/month format, assuming current year)
  const pattern3 = normalized.match(/(?:on\s+)?(\d{1,2})[\/\-](\d{1,2})\b/);
  if (pattern3) {
    const day = parseInt(pattern3[1]);
    const month = parseInt(pattern3[2]) - 1; // Month is 0-indexed
    
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const year = today.getFullYear();
      const parsedDate = new Date(year, month, day);
      
      // If the date has passed this year, use next year
      if (parsedDate < today) {
        parsedDate.setFullYear(year + 1);
      }
      
      return { date: parsedDate, matchStr: pattern3[0] };
    }
  }

  return null;
}

