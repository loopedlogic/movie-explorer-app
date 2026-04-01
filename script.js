const API_KEY = "YOUR_API_KEY";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_URL = "https://image.tmdb.org/t/p/original";

const moviesContainer = document.getElementById("moviesContainer");
const loading = document.getElementById("loading");
const heroSection = document.getElementById("heroSection");
const heroTitle = document.getElementById("heroTitle");
const heroOverview = document.getElementById("heroOverview");
const genreFilter = document.getElementById("genreFilter");
const sortMovies = document.getElementById("sortMovies");
const searchInput = document.getElementById("searchInput");

let allMovies = [];
let allGenres = [];

async function fetchGenres() {
  const response = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`);
  const data = await response.json();

  allGenres = data.genres;

  data.genres.forEach((genre) => {
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

    allMovies = data.results;

    setHeroMovie(allMovies[0]);
    renderMovies(allMovies);

    loading.style.display = "none";
  } catch (error) {
    loading.textContent = "Failed to load movies.";
    console.error(error);
  }
}

function setHeroMovie(movie) {
  heroSection.style.backgroundImage = `url(${IMAGE_URL + movie.backdrop_path})`;
  heroTitle.textContent = movie.title;
  heroOverview.textContent = movie.overview;
}

function renderMovies(movies) {
  moviesContainer.innerHTML = "";

  movies.forEach((movie) => {
    const genres = movie.genre_ids
      .map(id => allGenres.find(genre => genre.id === id)?.name)
      .filter(Boolean)
      .slice(0, 2);

    const card = document.createElement("div");
    card.classList.add("movie-card");

    card.innerHTML = `
      <img src="${IMAGE_URL + movie.poster_path}" alt="${movie.title}">

      <div class="movie-info">
        <h3>${movie.title}</h3>

        <div class="movie-meta">
          <span>⭐ ${movie.vote_average.toFixed(1)}</span>
          <span>${movie.release_date?.slice(0,4)}</span>
        </div>

        <div>
          ${genres.map(genre => `<span class="genre-tag">${genre}</span>`).join("")}
        </div>
      </div>
    `;

    moviesContainer.appendChild(card);
  });
}

searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();

  const filteredMovies = allMovies.filter(movie =>
    movie.title.toLowerCase().includes(query)
  );

  renderMovies(filteredMovies);
});

genreFilter.addEventListener("change", () => {
  const selectedGenre = genreFilter.value;

  const filteredMovies = selectedGenre === "all"
    ? allMovies
    : allMovies.filter(movie =>
        movie.genre_ids.includes(Number(selectedGenre))
      );

  renderMovies(filteredMovies);
});

sortMovies.addEventListener("change", () => {
  const sorted = [...allMovies];

  if (sortMovies.value === "rating") {
    sorted.sort((a, b) => b.vote_average - a.vote_average);
  }

  if (sortMovies.value === "latest") {
    sorted.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
  }

  if (sortMovies.value === "popular") {
    sorted.sort((a, b) => b.popularity - a.popularity);
  }

  renderMovies(sorted);
});

async function init() {
  await fetchGenres();
  await fetchMovies();
}

init();
