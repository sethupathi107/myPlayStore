import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { appsApi, categoriesApi, errorMessage } from "../api";
import { AppCard } from "../components/AppCard";
import { Loading, ErrorMessage } from "../components/Loading";
import { revealDelay } from "../lib/reveal";

const DEBOUNCE_MS = 300;

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const categoryId = searchParams.get("category") || "";

  const [inputValue, setInputValue] = useState(query);
  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef(null);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  function updateQuery(next) {
    const params = new URLSearchParams(searchParams);
    if (next.q !== undefined) {
      if (next.q) params.set("q", next.q);
      else params.delete("q");
    }
    if (next.category !== undefined) {
      if (next.category) params.set("category", next.category);
      else params.delete("category");
    }
    setSearchParams(params, { replace: true });
  }

  function handleInputChange(event) {
    const value = event.target.value;
    setInputValue(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateQuery({ q: value }), DEBOUNCE_MS);
  }

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    appsApi
      .search(query, categoryId || undefined)
      .then((data) => {
        if (cancelled) return;
        setResults(data.results);
        setTotal(data.total);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [query, categoryId]);

  const categoryName = categories.find((c) => c.id === categoryId)?.name;

  return (
    <div className="page">
      <div className="search-hero reveal">
        <h1 className="headline-section">
          Find something <span className="accent-cobalt crayon">worth keeping</span>.
        </h1>

        <div className="search-input-wrap">
          <SearchIcon size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search apps…"
            value={inputValue}
            onChange={handleInputChange}
            aria-label="Search apps"
            autoFocus
          />
          <span className="search-tag">OPENSEARCH</span>
        </div>

        <div className="chip-row">
          <button
            type="button"
            className={`chip ${!categoryId ? "is-active" : ""}`}
            onClick={() => updateQuery({ category: "" })}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`chip ${categoryId === category.id ? "is-active" : ""}`}
              onClick={() => updateQuery({ category: category.id })}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {!query.trim() && <p className="status-text">Start typing above to find an app.</p>}

      {loading && <Loading text="Searching…" />}
      <ErrorMessage message={error} />

      {!loading && query.trim() && !error && (
        <p className="eyebrow">
          {total} RESULT{total === 1 ? "" : "S"}
          {categoryName ? ` IN ${categoryName.toUpperCase()}` : ""}
        </p>
      )}

      {!loading && query.trim() && !error && results.length === 0 && (
        <div className="search-empty">
          <h3 className="headline-section">Nothing on this shelf.</h3>
          <p>Try a shorter word, or clear the category filter.</p>
        </div>
      )}

      <div className="app-grid" style={{ gridTemplateColumns: "1fr" }}>
        {results.map((hit, i) => (
          <div key={hit.id} className="reveal" style={revealDelay(i, { quick: true })}>
            <AppCard app={hit} />
          </div>
        ))}
      </div>
    </div>
  );
}
