const API_MEDIA_URL = "https://wger.de";
const ENGLISH_LANGUAGE_ID = 2;
const TRUSTED_MEDIA_HOSTS = ["wger.de"];

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

export function getYoutubeSearchUrl(exerciseName) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exerciseName} exercise proper form tutorial`)}`;
}

export function normalizeExercise(exercise) {
  const translation = getExerciseTranslation(exercise);
  const displayName = translation.name || exercise.name || "";
  const primaryMuscles = getNames(exercise.muscles);
  const secondaryMuscles = getNames(exercise.muscles_secondary);
  const equipmentNames = getNames(exercise.equipment);

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
      exercise.category?.name,
      ...primaryMuscles,
      ...secondaryMuscles,
      ...equipmentNames
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    secondaryMuscles,
    translation
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
    videos: []
  };
}
