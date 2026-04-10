const API_KEY = import.meta.env?.VITE_TMDB_API_KEY || "bf2f023305ac3e65dbdec674e99f8d43";
const BASE_URL = "https://api.themoviedb.org/3";
const POSTER_URL = "https://image.tmdb.org/t/p/w500";
const BACKDROP_URL = "https://image.tmdb.org/t/p/w1280";
const WATCHLIST_KEY = "movie-explorer-watchlist";
const SEARCH_DEBOUNCE_MS = 300;

const moviesContainer = document.getElementById("moviesContainer");
const loading = document.getElementById("loading");
const loadingSpinner = document.getElementById("loadingSpinner");
const heroSection = document.getElementById("heroSection");
const heroTitle = document.getElementById("heroTitle");
const heroOverview = document.getElementById("heroOverview");
const heroRating = document.getElementById("heroRating");
const heroYear = document.getElementById("heroYear");
const heroGenres = document.getElementById("heroGenres");
const genreFilter = document.getElementById("genreFilter");
const sortMovies = document.getElementById("sortMovies");
const searchInput = document.getElementById("searchInput");
const watchlistBtn = document.getElementById("watchlistBtn");
const watchlistCount = document.getElementById("watchlistCount");
const heroExploreBtn = document.getElementById("heroExploreBtn");
const heroWatchlistBtn = document.getElementById("heroWatchlistBtn");
const movieModal = document.getElementById("movieModal");
const movieModalBody = document.getElementById("movieModalBody");
const watchlistModal = document.getElementById("watchlistModal");
const watchlistContainer = document.getElementById("watchlistContainer");

let popularMovies = [];
let currentMovies = [];
let displayedMovies = [];
let allGenres = [];
let activeMovie = null;
let searchDebounceId = null;
let searchController = null;
let watchlistMovies = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]");
// Cache detail payloads so reopening a movie or jumping through similar titles feels instant.
const movieDetailsCache = new Map();

function fetchFromTMDB(path, params = {}, controller) {
  if (!API_KEY) {
    throw new Error("Missing TMDB API key. Set VITE_TMDB_API_KEY before deploying.");
  }

  const url = new URL(`${BASE_URL}${path}`);
  const searchParams = new URLSearchParams({
    api_key: API_KEY,
    ...params,
  });

  url.search = searchParams.toString();

  return fetch(url, { signal: controller?.signal }).then(async (response) => {
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.status_message || "TMDB request failed.");
    }

    return data;
  });
}

function showListStatus(message, type = "default", isLoading = false) {
  loading.textContent = message;
  loading.classList.remove("status-error", "status-success");

  if (type === "error") {
    loading.classList.add("status-error");
  }

  if (type === "success") {
    loading.classList.add("status-success");
  }

  loadingSpinner.classList.toggle("is-hidden", !isLoading);
}

function getGenreNames(genreIds = []) {
  return genreIds
    .map((id) => allGenres.find((genre) => genre.id === id)?.name)
    .filter(Boolean);
}

function normalizeMovie(movie) {
  return {
    ...movie,
    genre_ids: movie.genre_ids || [],
    overview: movie.overview || "No synopsis is available for this title yet.",
    release_date: movie.release_date || "",
  };
}

function getMovieFromState(movieId) {
  return [...displayedMovies, ...currentMovies, ...popularMovies, ...watchlistMovies]
    .find((movie) => movie.id === movieId);
}

function saveWatchlist() {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlistMovies));
  watchlistCount.textContent = watchlistMovies.length;
  heroWatchlistBtn.textContent = watchlistMovies.find((movie) => movie.id === activeMovie?.id)
    ? "Saved in Watchlist"
    : "Save to Watchlist";
}

function toggleWatchlist(movie) {
  const safeMovie = normalizeMovie(movie);
  const exists = watchlistMovies.find((item) => item.id === safeMovie.id);

  watchlistMovies = exists
    ? watchlistMovies.filter((item) => item.id !== safeMovie.id)
    : [...watchlistMovies, safeMovie];

  saveWatchlist();
  renderMovies(displayedMovies);

  if (!watchlistModal.classList.contains("is-hidden")) {
    renderWatchlist();
  }
}

function setHeroMovie(movie) {
  if (!movie) return;

  activeMovie = normalizeMovie(movie);

  heroSection.style.backgroundImage = activeMovie.backdrop_path
    ? `url(${BACKDROP_URL + activeMovie.backdrop_path})`
    : "none";
  heroTitle.textContent = activeMovie.title;
  heroOverview.textContent = activeMovie.overview;
  heroRating.textContent = `TMDB ${Number(activeMovie.vote_average || 0).toFixed(1)}`;
  heroYear.textContent = activeMovie.release_date ? activeMovie.release_date.slice(0, 4) : "Coming Soon";
  heroGenres.textContent = getGenreNames(activeMovie.genre_ids).slice(0, 3).join(" • ") || "Featured";

  document.querySelectorAll(".movie-card").forEach((card) => {
    card.classList.toggle("active", Number(card.dataset.movieId) === activeMovie.id);
  });

  saveWatchlist();
}

function sortMovieList(movies) {
  const sortedMovies = [...movies];

  if (sortMovies.value === "rating") {
    return sortedMovies.sort((a, b) => b.vote_average - a.vote_average);
  }

  if (sortMovies.value === "latest") {
    return sortedMovies.sort((a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0));
  }

  return sortedMovies.sort((a, b) => b.popularity - a.popularity);
}

function getProcessedMovies(movies) {
  const selectedGenre = genreFilter.value;

  return sortMovieList(
    movies.filter((movie) =>
      selectedGenre === "all" || movie.genre_ids.includes(Number(selectedGenre))
    )
  );
}

function renderEmptyState(title, message) {
  moviesContainer.innerHTML = `
    <div class="empty-state">
      <h3>${title}</h3>
      <p>${message}</p>
    </div>
  `;
}

function renderMovies(movies) {
  displayedMovies = movies;
  moviesContainer.innerHTML = "";

  if (!movies.length) {
    renderEmptyState(
      "No movies found",
      "Try another search term or switch genres to explore more titles."
    );
    return;
  }

  const cardsMarkup = movies.map((movie) => {
    const genres = getGenreNames(movie.genre_ids).slice(0, 3);
    const isSaved = watchlistMovies.find((item) => item.id === movie.id);

    return `
      <article class="movie-card ${activeMovie?.id === movie.id ? "active" : ""}" data-movie-id="${movie.id}">
        <div class="movie-poster">
          <img src="${POSTER_URL + movie.poster_path}" alt="${movie.title}">
          <span class="movie-rating">⭐ ${Number(movie.vote_average || 0).toFixed(1)}</span>
        </div>

        <div class="movie-info">
          <h3>${movie.title}</h3>

          <div class="movie-meta">
            <span>${movie.release_date?.slice(0, 4) || "TBA"}</span>
            <span>${genres[0] || "Feature Film"}</span>
          </div>

          <div class="genre-row">
            ${genres.map((genre) => `<span class="genre-tag">${genre}</span>`).join("")}
          </div>

          <div class="movie-actions">
            <button class="movie-action primary" type="button" data-action="details" data-movie-id="${movie.id}">
              View Details
            </button>
            <button class="movie-action secondary" type="button" data-action="watchlist" data-movie-id="${movie.id}">
              ${isSaved ? "Remove" : "+ Watchlist"}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  moviesContainer.innerHTML = cardsMarkup;

  if (!movies.find((movie) => movie.id === activeMovie?.id)) {
    setHeroMovie(movies.find((movie) => movie.backdrop_path) || movies[0]);
  }
}

function openModal(modal) {
  modal.classList.remove("is-hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  modal.classList.add("is-hidden");
  modal.setAttribute("aria-hidden", "true");

  if ([movieModal, watchlistModal].every((item) => item.classList.contains("is-hidden"))) {
    document.body.classList.remove("modal-open");
  }
}

function renderWatchlist() {
  if (!watchlistMovies.length) {
    watchlistContainer.innerHTML = `
      <div class="empty-state">
        <h3>Your watchlist is empty</h3>
        <p>Save a few movies and they will show up here for quick access.</p>
      </div>
    `;
    return;
  }

  watchlistContainer.innerHTML = watchlistMovies.map((movie) => `
    <article class="watchlist-item">
      <div class="watchlist-thumb">
        <img src="${POSTER_URL + movie.poster_path}" alt="${movie.title}">
      </div>
      <div class="watchlist-copy">
        <h3>${movie.title}</h3>
        <p>${movie.release_date?.slice(0, 4) || "TBA"} • ${Number(movie.vote_average || 0).toFixed(1)}</p>
        <div class="watchlist-actions">
          <button class="movie-action primary" type="button" data-watchlist-action="details" data-movie-id="${movie.id}">
            Open
          </button>
          <button class="movie-action secondary" type="button" data-watchlist-action="remove" data-movie-id="${movie.id}">
            Remove
          </button>
        </div>
      </div>
    </article>
  `).join("");
}

function getTrailer(videos = []) {
  return videos.find((video) => video.site === "YouTube" && video.type === "Trailer")
    || videos.find((video) => video.site === "YouTube");
}

function buildDetailsMarkup(detail, credits, videos, similarMovies) {
  const genres = (detail.genres || []).map((genre) => genre.name);
  const cast = (credits.cast || []).slice(0, 5);
  const trailer = getTrailer(videos.results || []);
  const similar = (similarMovies.results || [])
    .filter((movie) => movie.poster_path || movie.backdrop_path)
    .slice(0, 6);
  const posterSource = detail.poster_path
    ? POSTER_URL + detail.poster_path
    : detail.backdrop_path
      ? BACKDROP_URL + detail.backdrop_path
      : "";

  return `
    <div class="modal-layout">
      <div class="modal-poster">
        <img src="${posterSource}" alt="${detail.title}">
      </div>

      <div>
        <div class="modal-title-row">
          <div>
            <p class="eyebrow">Movie Details</p>
            <h2 id="modalTitle">${detail.title}</h2>
          </div>
          <div class="modal-rating">⭐ ${Number(detail.vote_average || 0).toFixed(1)}</div>
        </div>

        <div class="modal-meta">
          <div class="modal-meta-card">
            <strong>Release Year</strong>
            <span>${detail.release_date?.slice(0, 4) || "TBA"}</span>
          </div>
          <div class="modal-meta-card">
            <strong>Genres</strong>
            <span>${genres.join(" • ") || "Unavailable"}</span>
          </div>
          <div class="modal-meta-card">
            <strong>Runtime</strong>
            <span>${detail.runtime ? `${detail.runtime} mins` : "Unavailable"}</span>
          </div>
        </div>

        <p class="modal-overview">${detail.overview || "No synopsis is available for this title yet."}</p>

        <div class="modal-actions">
          <button class="hero-btn" type="button" data-modal-action="watchlist" data-movie-id="${detail.id}">
            ${watchlistMovies.find((movie) => movie.id === detail.id) ? "Remove from Watchlist" : "+ Watchlist"}
          </button>
          ${trailer ? `
            <a class="hero-btn hero-btn-secondary" href="https://www.youtube.com/watch?v=${trailer.key}" target="_blank" rel="noopener noreferrer">
              Watch Trailer
            </a>
          ` : `
            <button class="hero-btn hero-btn-secondary" type="button" disabled>No Trailer Available</button>
          `}
        </div>

        <section class="modal-section">
          <h3>Top Cast</h3>
          <div class="cast-list">
            ${cast.map((person) => `
              <div class="cast-pill">
                <strong>${person.name}</strong>
                <span>${person.character || "Cast"}</span>
              </div>
            `).join("") || "<p>No cast information available.</p>"}
          </div>
        </section>

        <section class="modal-section">
          <h3>Similar Movies</h3>
          <div class="similar-grid">
            ${similar.map((movie) => `
              <article class="similar-card">
                <button type="button" data-similar-id="${movie.id}">
                  <img src="${movie.backdrop_path ? BACKDROP_URL + movie.backdrop_path : POSTER_URL + movie.poster_path}" alt="${movie.title}">
                  <div class="similar-card-content">
                    <h4>${movie.title}</h4>
                    <p>${movie.release_date?.slice(0, 4) || "TBA"} • ⭐ ${Number(movie.vote_average || 0).toFixed(1)}</p>
                  </div>
                </button>
              </article>
            `).join("") || "<p>No similar titles available right now.</p>"}
          </div>
        </section>
      </div>
    </div>
  `;
}

async function openMovieDetails(movieId) {
  const movie = getMovieFromState(movieId);
  const fallbackMovie = movie || activeMovie;

  movieModalBody.innerHTML = `
    <div class="empty-state">
      <div class="loading-spinner"></div>
      <p style="margin-top: 16px;">Loading movie details...</p>
    </div>
  `;
  openModal(movieModal);

  if (movieDetailsCache.has(movieId)) {
    const cached = movieDetailsCache.get(movieId);
    movieModalBody.innerHTML = buildDetailsMarkup(cached.detail, cached.credits, cached.videos, cached.similarMovies);
    setHeroMovie({
      ...normalizeMovie(fallbackMovie || cached.detail),
      ...cached.detail,
      genre_ids: cached.detail.genres?.map((genre) => genre.id) || fallbackMovie?.genre_ids || [],
    });
    return;
  }

  try {
    const [detail, credits, videos, similarMovies] = await Promise.all([
      fetchFromTMDB(`/movie/${movieId}`),
      fetchFromTMDB(`/movie/${movieId}/credits`),
      fetchFromTMDB(`/movie/${movieId}/videos`),
      fetchFromTMDB(`/movie/${movieId}/similar`),
    ]);

    movieDetailsCache.set(movieId, { detail, credits, videos, similarMovies });
    movieModalBody.innerHTML = buildDetailsMarkup(detail, credits, videos, similarMovies);
    setHeroMovie({
      ...normalizeMovie(fallbackMovie || detail),
      ...detail,
      genre_ids: detail.genres?.map((genre) => genre.id) || fallbackMovie?.genre_ids || [],
    });
  } catch (error) {
    movieModalBody.innerHTML = `
      <div class="empty-state">
        <h3>Unable to load movie details</h3>
        <p>Please try again in a moment.</p>
      </div>
    `;
    console.error(error);
  }
}

function applyCurrentView(movies, successMessage) {
  const filteredMovies = getProcessedMovies(movies);
  renderMovies(filteredMovies);
  showListStatus(successMessage || `${filteredMovies.length} movies`, filteredMovies.length ? "success" : "default", false);

  if (!filteredMovies.length) {
    renderEmptyState(
      "No movies found",
      "Try another search term or switch genres to explore more titles."
    );
  }
}

async function loadPopularMovies() {
  try {
    showListStatus("Loading movies...", "default", true);
    const data = await fetchFromTMDB("/movie/popular");

    popularMovies = (data.results || [])
      .map(normalizeMovie)
      .filter((movie) => movie.poster_path);
    currentMovies = popularMovies;
    applyCurrentView(currentMovies, `${popularMovies.length} popular movies`);
  } catch (error) {
    showListStatus("We couldn't load movies right now.", "error", false);
    renderEmptyState(
      "Something went wrong",
      "The movie service is unavailable right now. Please try again shortly."
    );
    console.error(error);
  }
}

async function searchMovies(query) {
  if (searchController) {
    searchController.abort();
  }

  if (!query.trim()) {
    currentMovies = popularMovies;
    applyCurrentView(currentMovies, `${popularMovies.length} popular movies`);
    return;
  }

  searchController = new AbortController();

  try {
    // Search becomes the active data source, then the existing genre/sort pipeline is reapplied.
    showListStatus(`Searching for "${query}"...`, "default", true);
    const data = await fetchFromTMDB(
      "/search/movie",
      { query, include_adult: "false" },
      searchController
    );

    currentMovies = (data.results || [])
      .map(normalizeMovie)
      .filter((movie) => movie.poster_path);

    applyCurrentView(currentMovies, currentMovies.length ? `${currentMovies.length} search results` : "No movies found");
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }

    showListStatus("Search failed. Please try again.", "error", false);
    renderEmptyState(
      "Search unavailable",
      "We couldn't complete that search. Please check your connection and try again."
    );
    console.error(error);
  }
}

function debounceSearch(query) {
  clearTimeout(searchDebounceId);
  searchDebounceId = setTimeout(() => {
    searchMovies(query);
  }, SEARCH_DEBOUNCE_MS);
}

async function fetchGenres() {
  try {
    const data = await fetchFromTMDB("/genre/movie/list");
    allGenres = data.genres || [];

    genreFilter.innerHTML = `
      <option value="all">All Genres</option>
      ${allGenres.map((genre) => `<option value="${genre.id}">${genre.name}</option>`).join("")}
    `;
  } catch (error) {
    showListStatus("We couldn't load movie genres.", "error", false);
    console.error(error);
  }
}

function handleMovieGridClick(event) {
  const action = event.target.dataset.action;
  const movieId = Number(event.target.dataset.movieId || event.target.closest(".movie-card")?.dataset.movieId);
  const movie = getMovieFromState(movieId);

  if (!movieId || !movie) {
    return;
  }

  if (action === "watchlist") {
    toggleWatchlist(movie);
    return;
  }

  if (action === "details") {
    openMovieDetails(movieId);
    return;
  }

  if (!event.target.closest(".movie-actions")) {
    openMovieDetails(movieId);
  }
}

function handleWatchlistClick(event) {
  const movieId = Number(event.target.dataset.movieId);
  const action = event.target.dataset.watchlistAction;
  const movie = watchlistMovies.find((item) => item.id === movieId);

  if (!movieId || !action || !movie) {
    return;
  }

  if (action === "remove") {
    toggleWatchlist(movie);
    return;
  }

  closeModal(watchlistModal);
  openMovieDetails(movieId);
}

function handleMovieModalClick(event) {
  const similarId = Number(event.target.closest("[data-similar-id]")?.dataset.similarId);
  const modalAction = event.target.dataset.modalAction;
  const movieId = Number(event.target.dataset.movieId);

  if (similarId) {
    openMovieDetails(similarId);
    return;
  }

  if (modalAction === "watchlist") {
    const detailMovie = movieDetailsCache.get(movieId)?.detail || getMovieFromState(movieId);

    if (detailMovie) {
      toggleWatchlist({
        ...normalizeMovie(detailMovie),
        genre_ids: detailMovie.genre_ids || detailMovie.genres?.map((genre) => genre.id) || [],
      });
      openMovieDetails(movieId);
    }
  }
}

function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    debounceSearch(event.target.value.trim());
  });

  genreFilter.addEventListener("change", () => {
    applyCurrentView(currentMovies, `${getProcessedMovies(currentMovies).length} movies`);
  });

  sortMovies.addEventListener("change", () => {
    applyCurrentView(currentMovies, `${getProcessedMovies(currentMovies).length} movies`);
  });

  watchlistBtn.addEventListener("click", () => {
    renderWatchlist();
    openModal(watchlistModal);
  });

  heroExploreBtn.addEventListener("click", () => {
    document.getElementById("moviesSection").scrollIntoView({ behavior: "smooth" });
  });

  heroWatchlistBtn.addEventListener("click", () => {
    if (activeMovie) {
      toggleWatchlist(activeMovie);
    }
  });

  moviesContainer.addEventListener("click", handleMovieGridClick);
  watchlistContainer.addEventListener("click", handleWatchlistClick);
  movieModalBody.addEventListener("click", handleMovieModalClick);

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      closeModal(document.getElementById(button.dataset.close));
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal(movieModal);
      closeModal(watchlistModal);
    }
  });
}

async function init() {
  saveWatchlist();
  bindEvents();
  await fetchGenres();
  await loadPopularMovies();
}

init();
