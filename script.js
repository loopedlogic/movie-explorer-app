const API_KEY = "bf2f023305ac3e65dbdec674e99f8d43";
const BASE_URL = "https://api.themoviedb.org/3";
const POSTER_URL = "https://image.tmdb.org/t/p/w500";
const BACKDROP_URL = "https://image.tmdb.org/t/p/w1280";
const WATCHLIST_KEY = "movie-explorer-watchlist";

const moviesContainer = document.getElementById("moviesContainer");
const loading = document.getElementById("loading");
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

let allMovies = [];
let allGenres = [];
let activeMovieId = null;
let watchlist = new Set(JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]"));

function saveWatchlist() {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...watchlist]));
  watchlistCount.textContent = watchlist.size;
  heroWatchlistBtn.textContent = watchlist.has(activeMovieId)
    ? "Saved in Watchlist"
    : "Save to Watchlist";
}

function getGenreNames(genreIds) {
  return genreIds
    .map((id) => allGenres.find((genre) => genre.id === id)?.name)
    .filter(Boolean);
}

function setHeroMovie(movie) {
  if (!movie) return;

  activeMovieId = movie.id;
  heroSection.style.backgroundImage = `url(${BACKDROP_URL + movie.backdrop_path})`;
  heroTitle.textContent = movie.title;
  heroOverview.textContent = movie.overview || "A cinematic pick worth adding to your queue.";
  heroRating.textContent = `TMDB ${movie.vote_average.toFixed(1)}`;
  heroYear.textContent = movie.release_date ? movie.release_date.slice(0, 4) : "Coming Soon";
  heroGenres.textContent = getGenreNames(movie.genre_ids).slice(0, 3).join(" • ") || "Featured";

  document.querySelectorAll(".movie-card").forEach((card) => {
    card.classList.toggle("active", Number(card.dataset.movieId) === movie.id);
  });

  saveWatchlist();
}

function toggleWatchlist(movieId) {
  if (watchlist.has(movieId)) {
    watchlist.delete(movieId);
  } else {
    watchlist.add(movieId);
  }

  saveWatchlist();
  renderMovies(getProcessedMovies());
}

function getProcessedMovies() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedGenre = genreFilter.value;
  const sorted = [...allMovies].filter((movie) => {
    const matchesQuery = movie.title.toLowerCase().includes(query);
    const matchesGenre =
      selectedGenre === "all" || movie.genre_ids.includes(Number(selectedGenre));
    return matchesQuery && matchesGenre;
  });

  if (sortMovies.value === "rating") {
    sorted.sort((a, b) => b.vote_average - a.vote_average);
  }

  if (sortMovies.value === "latest") {
    sorted.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
  }

  if (sortMovies.value === "popular") {
    sorted.sort((a, b) => b.popularity - a.popularity);
  }

  return sorted;
}

function renderMovies(movies) {
  moviesContainer.innerHTML = "";

  if (!movies.length) {
    moviesContainer.innerHTML = `
      <div class="empty-state">
        <h3>No movies found</h3>
        <p>Try a different search or genre to explore more titles.</p>
      </div>
    `;
    loading.textContent = "0 results";
    return;
  }

  loading.textContent = `${movies.length} movies`;

  movies.forEach((movie) => {
    const genres = getGenreNames(movie.genre_ids).slice(0, 3);
    const card = document.createElement("article");
    card.className = "movie-card";
    card.dataset.movieId = movie.id;

    card.innerHTML = `
      <div class="movie-poster">
        <img src="${POSTER_URL + movie.poster_path}" alt="${movie.title}">
        <span class="movie-rating">⭐ ${movie.vote_average.toFixed(1)}</span>
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
          <button class="movie-action primary" type="button" data-action="feature">Feature</button>
          <button class="movie-action secondary" type="button" data-action="watchlist">
            ${watchlist.has(movie.id) ? "Saved" : "Watchlist"}
          </button>
        </div>
      </div>
    `;

    card.addEventListener("click", (event) => {
      const action = event.target.dataset.action;

      if (action === "watchlist") {
        event.stopPropagation();
        toggleWatchlist(movie.id);
        return;
      }

      setHeroMovie(movie);
    });

    moviesContainer.appendChild(card);
  });

  if (!movies.some((movie) => movie.id === activeMovieId)) {
    setHeroMovie(movies[0]);
  } else {
    document.querySelectorAll(".movie-card").forEach((card) => {
      card.classList.toggle("active", Number(card.dataset.movieId) === activeMovieId);
    });
  }
}

async function fetchGenres() {
  const response = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`);
  const data = await response.json();
  allGenres = data.genres || [];

  allGenres.forEach((genre) => {
    const option = document.createElement("option");
    option.value = genre.id;
    option.textContent = genre.name;
    genreFilter.appendChild(option);
  });
}

async function fetchMovies() {
  try {
    loading.textContent = "Loading movies...";

    const response = await fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}`);
    const data = await response.json();

    allMovies = (data.results || []).filter((movie) => movie.poster_path && movie.backdrop_path);
    setHeroMovie(allMovies[0]);
    renderMovies(getProcessedMovies());
  } catch (error) {
    loading.textContent = "Failed to load movies.";
    moviesContainer.innerHTML = `
      <div class="empty-state">
        <h3>Something went wrong</h3>
        <p>We could not load the latest movies right now. Please try again shortly.</p>
      </div>
    `;
    console.error(error);
  }
}

searchInput.addEventListener("input", () => {
  renderMovies(getProcessedMovies());
});

genreFilter.addEventListener("change", () => {
  renderMovies(getProcessedMovies());
});

sortMovies.addEventListener("change", () => {
  renderMovies(getProcessedMovies());
});

watchlistBtn.addEventListener("click", () => {
  const watchlistMovies = allMovies.filter((movie) => watchlist.has(movie.id));
  renderMovies(watchlistMovies.length ? watchlistMovies : getProcessedMovies());
  loading.textContent = watchlistMovies.length ? `${watchlistMovies.length} saved movies` : "Your watchlist is empty";
});

heroExploreBtn.addEventListener("click", () => {
  document.getElementById("moviesSection").scrollIntoView({ behavior: "smooth" });
});

heroWatchlistBtn.addEventListener("click", () => {
  if (activeMovieId) {
    toggleWatchlist(activeMovieId);
  }
});

async function init() {
  saveWatchlist();
  await fetchGenres();
  await fetchMovies();
}

init();
