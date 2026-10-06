import { useEffect, useState } from "react";
import { categoriesApi, errorMessage } from "../../api";
import { Loading, ErrorMessage } from "../../components/Loading";

export function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  function loadCategories() {
    setLoading(true);
    setError("");
    categoriesApi
      .list()
      .then(setCategories)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(loadCategories, []);

  async function handleCreate(event) {
    event.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      const category = await categoriesApi.create(name.trim());
      setCategories((current) => [...current, category]);
      setName("");
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="admin-panel">
      <h2 className="headline-section">Categories</h2>

      <form onSubmit={handleCreate} style={{ maxWidth: 420 }}>
        <input
          type="text"
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          maxLength={50}
          required
        />
        <button className="btn btn-primary" type="submit" disabled={creating}>
          {creating ? "Adding…" : "Add category"}
        </button>
      </form>
      <ErrorMessage message={createError} />

      {loading && <Loading text="Loading categories…" />}
      <ErrorMessage message={error} />

      {!loading && !error && (
        <div className="offset-card table-scroll" style={{ padding: 8 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>{new Date(category.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
