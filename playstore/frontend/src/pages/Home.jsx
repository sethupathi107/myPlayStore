import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  Briefcase,
  Code2,
  GraduationCap,
  Clapperboard,
  Landmark,
  Gamepad2,
  Palette,
  HeartPulse,
  Music,
  Newspaper,
  Camera,
  LayoutGrid,
  Users,
  Plane,
  CloudSun,
  Coffee,
} from "lucide-react";
import { appsApi, categoriesApi, imagesApi } from "../api";
import { AppIcon } from "../components/AppIcon";
import { InstallButton } from "../components/InstallButton";
import { Loading } from "../components/Loading";
import { accentFor, hashString } from "../lib/accents";
import { withMockCatalogFields } from "../lib/mockApi";
import { revealDelay } from "../lib/reveal";

const HERO_SIZE = 3;
const NEW_SIZE = 8;
const RANKED_SIZE = 9;
const TRENDING_SIZE = 9;
const TRENDING_PER_CATEGORY_SIZE = 3;
const TRENDING_DAYS = 7;
const HERO_INTERVAL_MS = 5500;

const CATEGORY_ICONS = [
  Briefcase,
  Code2,
  GraduationCap,
  Clapperboard,
  Landmark,
  Gamepad2,
  Palette,
  HeartPulse,
  Coffee,
  Music,
  Newspaper,
  Camera,
  LayoutGrid,
  Users,
  Plane,
  CloudSun,
];
const HERO_EYEBROWS = ["APP OF THE DAY", "EDITORS' PICK", "GAME OF THE WEEK"];

function useAppIconUrl(app) {
  const [iconUrl, setIconUrl] = useState(null);
  useEffect(() => {
    if (!app?.iconImageId) {
      setIconUrl(null);
      return;
    }
    let objectUrl = null;
    imagesApi
      .getObjectUrl(app.id, app.iconImageId)
      .then((url) => {
        objectUrl = url;
        setIconUrl(url);
      })
      .catch(() => {});
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [app?.id, app?.iconImageId]);
  return iconUrl;
}

function HeroSlide({ app, eyebrow, isActive }) {
  const enriched = withMockCatalogFields(app);
  const iconUrl = useAppIconUrl(app);
  const rotation = (hashString(app.id) % 13) - 6; // -6deg..6deg

  return (
    <div className={`hero-slide ${isActive ? "is-active" : ""}`}>
      <div className="hero-copy">
        <span className="eyebrow eyebrow-on-cobalt">{eyebrow}</span>
        <h2 className="hero-title">Don't miss what everyone's installing this week.</h2>
        <span className="hero-meta">
          {enriched.name} · {enriched.tagline}
        </span>
        <div className="hero-actions">
          <InstallButton app={enriched} />
          <Link to={`/apps/${app.id}`} className="btn btn-outline" style={{ borderColor: "rgba(252,254,220,.5)", color: "var(--cream)" }}>
            View details
          </Link>
        </div>
      </div>
      <div className="hero-icon-wrap">
        <AppIcon
          seed={app.id}
          letter={app.name[0]?.toUpperCase()}
          iconUrl={iconUrl}
          style={{ transform: isActive ? `rotate(${rotation}deg)` : "none" }}
        />
      </div>
    </div>
  );
}

function HeroCarousel({ apps }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (apps.length < 2) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((i) => (i + 1) % apps.length);
    }, HERO_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [apps.length]);

  if (apps.length === 0) return null;

  return (
    <div className="hero reveal">
      {apps.map((app, i) => (
        <HeroSlide key={app.id} app={app} eyebrow={HERO_EYEBROWS[i % HERO_EYEBROWS.length]} isActive={i === activeIndex} />
      ))}
      {apps.length > 1 && (
        <div className="hero-dots">
          {apps.map((app, i) => (
            <span
              key={app.id}
              className={`hero-dot ${i === activeIndex ? "is-active" : ""}`}
              onClick={() => setActiveIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryRow({ category, index }) {
  const Icon = CATEGORY_ICONS[hashString(category.id) % CATEGORY_ICONS.length];
  return (
    <Link to={`/category/${category.id}`} className="category-row reveal" style={revealDelay(index, { quick: true })}>
      <span className="category-row-icon" style={accentFor(category.id)}>
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <span className="category-row-name">{category.name}</span>
      <ChevronRight size={18} className="category-row-chevron" />
    </Link>
  );
}

function NewThisWeekCard({ app, index }) {
  const enriched = withMockCatalogFields(app);
  const iconUrl = useAppIconUrl(app);

  return (
    <Link to={`/apps/${app.id}`} className="offset-card is-interactive new-card reveal" style={revealDelay(index)}>
      <div className="new-card-art" style={accentFor(app.id)}>
        <AppIcon seed={app.id} letter={app.name[0]?.toUpperCase()} iconUrl={iconUrl} />
      </div>
      <div className="new-card-body">
        <span className="eyebrow">{enriched.developerName}</span>
        <span className="new-card-name">{app.name}</span>
        <span className="new-card-tagline">{app.description || enriched.tagline}</span>
        <div className="new-card-footer">
          <span>★ {enriched.rating}</span>
          <span>{enriched.reviewCount} reviews</span>
        </div>
      </div>
    </Link>
  );
}

function RankedRow({ app, rank, index }) {
  const enriched = withMockCatalogFields(app);
  const iconUrl = useAppIconUrl(app);

  return (
    <Link to={`/apps/${app.id}`} className="app-row reveal" style={revealDelay(index, { quick: true })}>
      {rank != null && <span className="rank-number">{rank}</span>}
      <AppIcon seed={app.id} letter={app.name[0]?.toUpperCase()} iconUrl={iconUrl} />
      <div className="app-row-body">
        <span className="app-row-name">{app.name}</span>
        <span className="app-row-tagline">{app.description || enriched.tagline}</span>
      </div>
      <InstallButton app={enriched} size="small" />
    </Link>
  );
}

function CategoryTrendingShelf({ category, index }) {
  if (category.apps.length === 0) return null;
  return (
    <section>
      <div className="section-header">
        <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: 22 }}>{category.categoryName}</h3>
        <Link to={`/category/${category.categoryId}`} className="see-all">
          See all
        </Link>
      </div>
      <div className="app-grid" style={{ marginTop: 8 }}>
        {category.apps.map((app, i) => (
          <RankedRow key={app.id} app={app} index={index * 10 + i} />
        ))}
      </div>
    </section>
  );
}

export function Home() {
  const [heroApps, setHeroApps] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newApps, setNewApps] = useState([]);
  const [rankedApps, setRankedApps] = useState([]);
  const [trendingApps, setTrendingApps] = useState([]);
  const [trendingByCategory, setTrendingByCategory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      appsApi.hot(HERO_SIZE).then((data) => setHeroApps(data.results)),
      categoriesApi.list().then(setCategories),
      appsApi.list(1, NEW_SIZE).then((data) => setNewApps(data.results)),
      appsApi.hot(RANKED_SIZE).then((data) => setRankedApps(data.results)),
      appsApi.trending(TRENDING_DAYS, TRENDING_SIZE).then((data) => setTrendingApps(data.results)),
      appsApi
        .trendingByCategory(TRENDING_DAYS, TRENDING_PER_CATEGORY_SIZE)
        .then((data) => setTrendingByCategory(data.categories)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categoryNameById = useMemo(() => {
    const map = {};
    for (const category of categories) map[category.id] = category.name;
    return map;
  }, [categories]);

  if (loading) return <Loading text="Loading Discover…" />;

  const isEmpty = heroApps.length === 0 && newApps.length === 0 && categories.length === 0;

  return (
    <div className="page">
      {isEmpty && <p className="status-text">No apps here yet. Be the first to publish one.</p>}

      {heroApps.length > 0 && <HeroCarousel apps={heroApps} />}

      {categories.length > 0 && (
        <section>
          <div className="section-header">
            <h2 className="headline-section">Categories</h2>
          </div>
          <div className="category-grid">
            {categories.map((category, i) => (
              <CategoryRow key={category.id} category={category} index={i} />
            ))}
          </div>
        </section>
      )}

      {newApps.length > 0 && (
        <section>
          <div className="section-header">
            <h2 className="headline-section">New this week</h2>
          </div>
          <div className="scroll-row" style={{ marginTop: 20 }}>
            {newApps.map((app, i) => (
              <NewThisWeekCard key={app.id} app={{ ...app, categoryName: categoryNameById[app.categoryId] }} index={i} />
            ))}
          </div>
        </section>
      )}

      {trendingApps.length > 0 && (
        <section>
          <div className="section-header">
            <div>
              <h2 className="headline-section">Trending</h2>
              <span className="eyebrow">Frequently downloaded · Last {TRENDING_DAYS} days</span>
            </div>
          </div>
          <div className="app-grid" style={{ marginTop: 8 }}>
            {trendingApps.map((app, i) => (
              <RankedRow key={app.id} app={app} rank={i + 1} index={i} />
            ))}
          </div>
        </section>
      )}

      {trendingByCategory.length > 0 && (
        <section>
          <div className="section-header">
            <div>
              <h2 className="headline-section">Trending in each category</h2>
              <span className="eyebrow">Frequently downloaded · Last {TRENDING_DAYS} days</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 32, marginTop: 8 }}>
            {trendingByCategory.map((category, i) => (
              <CategoryTrendingShelf key={category.categoryId} category={category} index={i} />
            ))}
          </div>
        </section>
      )}

      {rankedApps.length > 0 && (
        <section>
          <div className="section-header">
            <h2 className="headline-section">Most downloaded</h2>
          </div>
          <div className="app-grid" style={{ marginTop: 8 }}>
            {rankedApps.map((app, i) => (
              <RankedRow key={app.id} app={app} rank={i + 1} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
