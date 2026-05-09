const API_MEDIA_URL = "https://wger.de";
const ENGLISH_LANGUAGE_ID = 2;
const TRUSTED_MEDIA_HOSTS = ["wger.de"];
const CARDIO_PATTERN = /\b(cardio|run|running|jog|jogging|sprint|treadmill|walk|walking|hike|hiking|cycle|cycling|bike|biking|spin|spinning|rower|rowing machine|erg|swim|swimming|elliptical|cross trainer|stair|stairs|stepper|step mill|jump rope|skipping|hiit|burpee|burpees|circuit)\b/i;
const STRENGTH_PATTERN = /\b(strength|bench press|squat|deadlift|press|dumbbell|barbell|kettlebell|push-up|push up|pushup|pull-up|pull up|pullup|chin-up|chin up|lunge|curl|pulldown|leg press|row|fly|raise|extension|resistance|bodyweight|calisthenics|core|plank|crunch|pilates)\b/i;

export function getExerciseTranslation(exercise) {
  return exercise.translations?.find((translation) => translation.language === ENGLISH_LANGUAGE_ID && translation.name)
    || exercise.translations?.find((translation) => translation.name)
    || {};
}

export function stripHtml(html) {
  if (!html) {
    return "";
  }

  if (typeof document === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(html, "text/html");
  return parsedDocument.body.textContent || "";
}

function isTrustedMediaUrl(url) {
  try {
    const parsedUrl = new URL(url, API_MEDIA_URL);
    return parsedUrl.protocol === "https:" && TRUSTED_MEDIA_HOSTS.some((host) => (
      parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`)
    ));
  } catch (error) {
    return false;
  }
}

export function getMediaUrl(path) {
  if (!path) {
    return "";
  }

  const mediaUrl = path.startsWith("http") ? path : `${API_MEDIA_URL}${path}`;
  return isTrustedMediaUrl(mediaUrl) ? mediaUrl : "";
}

export function getNames(items) {
  return items?.map((item) => item.name_en || item.name).filter(Boolean) || [];
}

export function getExerciseWorkoutType(exercise) {
  const searchableText = [
    exercise?.workoutType,
    exercise?.name,
    exercise?.displayName,
    exercise?.category,
    exercise?.category?.name,
    exercise?.translation?.name,
    exercise?.descriptionText,
    ...(exercise?.equipmentNames || []),
    ...(exercise?.primaryMuscles || []),
    ...(exercise?.secondaryMuscles || [])
  ]
    .filter(Boolean)
    .join(" ");

  if (exercise?.workoutType === "cardio" || CARDIO_PATTERN.test(searchableText)) {
    return "cardio";
  }

  if (exercise?.workoutType === "strength" || STRENGTH_PATTERN.test(searchableText)) {
    return "strength";
  }

  return "strength";
}

export function getYoutubeSearchUrl(exerciseName) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exerciseName} exercise proper form tutorial`)}`;
}

export function normalizeExercise(exercise) {
  const translation = getExerciseTranslation(exercise);
  const displayName = translation.name || exercise.name || "";
  const primaryMuscles = getNames(exercise.muscles);
  const secondaryMuscles = getNames(exercise.muscles_secondary);
  const equipmentNames = getNames(exercise.equipment);
  const workoutType = getExerciseWorkoutType({
    ...exercise,
    displayName,
    equipmentNames,
    primaryMuscles,
    secondaryMuscles
  });

  return {
    ...exercise,
    aliases: translation.aliases?.map((item) => item.alias).filter(Boolean) || [],
    descriptionText: stripHtml(translation.description),
    displayName,
    equipmentNames,
    hasMedia: Boolean(exercise.videos?.length || exercise.images?.length),
    primaryMuscles,
    searchIndex: [
      displayName,
      workoutType,
      exercise.category?.name,
      ...primaryMuscles,
      ...secondaryMuscles,
      ...equipmentNames
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    secondaryMuscles,
    translation,
    workoutType
  };
}

export function normalizeExercises(exercises) {
  return exercises
    .map(normalizeExercise)
    .filter((exercise) => Boolean(exercise.displayName));
}

export function normalizeCustomExercise(exercise) {
  const primaryMuscles = Array.isArray(exercise.primaryMuscles) ? exercise.primaryMuscles.filter(Boolean) : [];
  const secondaryMuscles = Array.isArray(exercise.secondaryMuscles) ? exercise.secondaryMuscles.filter(Boolean) : [];
  const equipmentNames = Array.isArray(exercise.equipment) ? exercise.equipment.filter(Boolean) : [];
  const displayName = exercise.name || "";
  const categoryName = exercise.category || "Custom";
  const createdByUsername = exercise.createdByUsername || "Community member";
  const workoutType = getExerciseWorkoutType({
    ...exercise,
    category: categoryName,
    displayName,
    equipmentNames,
    primaryMuscles,
    secondaryMuscles
  });

  return {
    ...exercise,
    aliases: [],
    author_history: [createdByUsername],
    category: { name: categoryName },
    descriptionText: exercise.instructions || "",
    displayName,
    equipmentNames,
    hasMedia: false,
    id: exercise._id,
    images: [],
    license: { short_name: "Custom" },
    license_author: createdByUsername,
    primaryMuscles,
    searchIndex: [
      displayName,
      workoutType,
      categoryName,
      ...primaryMuscles,
      ...secondaryMuscles,
      ...equipmentNames
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    secondaryMuscles,
    sourceType: "custom",
    total_authors_history: [createdByUsername],
    translation: {
      name: displayName,
      description: exercise.instructions || ""
    },
    videos: [],
    workoutType
  };
}
