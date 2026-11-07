import React, { useState } from 'react';
import { Edit3, Plus, Save, Trash2, X } from 'lucide-react';
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from '../../lib/merchantApi';
import {
  formatFiatMinor,
  parsePriceToMinor,
  SUPPORTED_PRICING_CURRENCIES,
} from '../../lib/widgetCore.mjs';
import { Field, inputClass, Panel } from './WidgetUi';

const emptyForm = {
  name: '',
  description: '',
  price: '',
  currency: 'USD',
};

export function ProductsPanel({ secret, products, onChanged }) {
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError('');
    const priceMinor = parsePriceToMinor(form.price);
    if (!priceMinor) {
      setError('Enter a price greater than zero');
      return;
    }
    setBusy(true);
    try {
      await createProduct(secret, {
        name: form.name,
        description: form.description,
        priceMinor,
        currency: form.currency,
      });
      setForm(emptyForm);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    setError('');
    const priceMinor = parsePriceToMinor(editing.price);
    if (!priceMinor) {
      setError('Enter a price greater than zero');
      return;
    }
    setBusy(true);
    try {
      await updateProduct(secret, editing.id, {
        name: editing.name,
        description: editing.description,
        priceMinor,
        currency: editing.currency,
      });
      setEditing(null);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(product) {
    try {
      await updateProduct(secret, product.id, { active: !product.active });
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(product) {
    if (!window.confirm(`Delete “${product.name}”? Existing orders are unaffected.`)) {
      return;
    }
    try {
      await deleteProduct(secret, product.id);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6 items-start">
      <Panel className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">
              {editing ? 'Edit product' : 'Add a product'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Prices are stored server-side and used to price every checkout.
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#14F195]/10 border border-[#14F195]/30">
            <Plus className="w-4 h-4 text-[#14F195]" />
          </div>
        </div>

        <form onSubmit={editing ? handleUpdate : handleCreate} className="space-y-3">
          <Field label="Product name">
            <input
              className={inputClass}
              value={editing ? editing.name : form.name}
              onChange={(e) =>
                editing
                  ? setEditing({ ...editing, name: e.target.value })
                  : update('name', e.target.value)
              }
              placeholder="product C 99kg"
              required
            />
          </Field>
          <Field label="Description">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={editing ? editing.description : form.description}
              onChange={(e) =>
                editing
                  ? setEditing({ ...editing, description: e.target.value })
                  : update('description', e.target.value)
              }
              placeholder="Light roast, floral, 250g bag"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price">
              <input
                type="number"
                min="0.01"
                step="0.01"
                className={inputClass}
                value={editing ? editing.price : form.price}
                onChange={(e) =>
                  editing
                    ? setEditing({ ...editing, price: e.target.value })
                    : update('price', e.target.value)
                }
                placeholder="24.00"
                required
              />
            </Field>
            <Field label="Currency">
              <select
                className={inputClass}
                value={editing ? editing.currency : form.currency}
                onChange={(e) =>
                  editing
                    ? setEditing({ ...editing, currency: e.target.value })
                    : update('currency', e.target.value)
                }
              >
                {SUPPORTED_PRICING_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {editing ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add product'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-3 rounded-xl bg-[#181b28] border border-[#2a2f45] text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </Panel>

      <Panel className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white">Catalog</h2>
          <span className="text-[11px] text-gray-500">{products.length} product(s)</span>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2a2f45] p-8 text-center text-xs text-gray-500">
            No products yet. Add one to generate a working widget snippet.
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl bg-[#0e1017] border border-[#1e2233] p-3.5 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white truncate">{product.name}</p>
                    {!product.active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/30">
                        inactive
                      </span>
                    )}
                  </div>
                  {product.description && (
                    <p className="text-[11px] text-gray-500 truncate">{product.description}</p>
                  )}
                  <p className="text-xs font-mono text-[#14F195] mt-1">
                    {formatFiatMinor(product.priceMinor, product.currency)}
                  </p>
                  <p className="text-[10px] text-gray-600 font-mono mt-0.5">{product.id}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() =>
                      setEditing({
                        id: product.id,
                        name: product.name,
                        description: product.description,
                        currency: product.currency,
                        price: (product.priceMinor / 100).toFixed(2),
                      })
                    }
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                    title="Edit product"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleActive(product)}
                    className="px-2 py-1.5 rounded-lg text-[10px] font-semibold text-gray-400 hover:text-white hover:bg-white/5"
                  >
                    {product.active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDelete(product)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-500/10"
                    title="Delete product"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
