const DATE_INPUT_MIN = "2000-01-01";
const MAX_FUTURE_WORKOUT_DAYS = 7;

export function formatDateInputValue(value = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return formatDateInputValue(new Date());
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getWorkoutDateInputBounds() {
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + MAX_FUTURE_WORKOUT_DAYS);

  return {
    min: DATE_INPUT_MIN,
    max: formatDateInputValue(maxDate)
  };
}
