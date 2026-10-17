import React from 'react';
import { Megaphone, Search, Download, ImagePlus, Globe, CheckCircle2, TrendingDown, Sparkles, Clock, Loader2, X, Undo2, RefreshCw, AlertTriangle } from 'lucide-react';
import { WebCatalog, WebCatalogVehicle, webCatalogService, webOnlyVehicles, matchWebCatalog, webPatente } from '../../services/webCatalogService';
import { Vehicle, UpdateHistoryRecord } from '../../types/stock';
import { stockService } from '../../services/stockService';
import { publicationsService } from '../../services/publicationsService';
import { drawStory, ensureStoryFonts, loadImage, canvasToBlob, storyFileName } from '../../services/storyRenderer';
import { getStockInsights, currentDrop } from '../../utils/stockInsights';
import { isAvailableVehicle } from '../../utils/stockSelectors';
import { matchesSearch } from '../../utils/search';
import { normalizePatent } from '../../utils/vehicleIdentity';
import { formatCurrency } from '../../utils/formatters';
import { MoneyInput } from '../stock/FilterPanel';
import { useMediaQuery } from '../../hooks/useMediaQuery';

type Tab = 'novedades' | 'precio' | 'pendientes' | 'web' | 'todas';

interface Props {
  vehicles: Vehicle[];
  webCatalog?: WebCatalog | null;
  onToast: (t: string, type?: 'success' | 'info' | 'warn') => void;
}

const daysSince = (iso?: string) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86_400_000) : null);

async function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const StoriesView: React.FC<Props> = ({ vehicles, webCatalog = null, onToast }) => {
  const [history, setHistory] = React.useState<UpdateHistoryRecord[]>(() => stockService.getUpdateHistory());
  React.useEffect(() => stockService.subscribeHistory(setHistory), []);
  const [pubs, setPubs] = React.useState(() => publicationsService.getMap());
  React.useEffect(() => publicationsService.subscribe(() => setPubs(publicationsService.getMap())), []);

  const { drops, nuevos } = React.useMemo(() => {
    const ins = getStockInsights(history);
    // Sumar lo que detecta la web de Autonet: unidades nuevas (7 días) y bajas de precio (14 días)
    if (webCatalog) {
      const now = Date.now();
      const { byPlate, unmatched } = matchWebCatalog(vehicles, webCatalog);
      const pairs: [string, WebCatalogVehicle][] = [...byPlate.entries(), ...unmatched.map((w) => [normalizePatent(webPatente(w)), w] as [string, WebCatalogVehicle])];
      pairs.forEach(([plate, w]) => {
        if (w.firstSeen && now - Date.parse(w.firstSeen) <= 7 * 86_400_000 && !ins.nuevos.has(plate)) ins.nuevos.set(plate, w.firstSeen);
        if (
          w.precioAnteriorWeb && w.precioPublicadoWeb && w.precioAnteriorWeb > w.precioPublicadoWeb &&
          w.cambioPrecioEl && now - Date.parse(w.cambioPrecioEl) <= 14 * 86_400_000 && !ins.drops.has(plate)
        ) {
          ins.drops.set(plate, { oldPrice: w.precioAnteriorWeb, newPrice: w.precioPublicadoWeb, fecha: w.cambioPrecioEl });
        }
      });
    }
    return ins;
  }, [history, webCatalog, vehicles]);
  const webOnly = React.useMemo(() => webOnlyVehicles(vehicles, webCatalog), [vehicles, webCatalog]);
  const [refreshing, setRefreshing] = React.useState(false);
  const available = React.useMemo(() => vehicles.filter(isAvailableVehicle), [vehicles]);

  const lists = React.useMemo(() => {
    const novedades = available.filter((v) => nuevos.has(normalizePatent(v.patente)));
    const precio = available.filter((v) => currentDrop(v, drops));
    const pendientes = available.filter((v) => {
      const p = pubs.get(normalizePatent(v.patente));
      const d = daysSince(p?.ultimaVez);
      return d === null || d >= 15;
    });
    const webNuevas = webOnly.filter((v) => nuevos.has(normalizePatent(v.patente)));
    return { novedades: [...novedades, ...webNuevas], precio, pendientes, web: webOnly, todas: available };
  }, [available, nuevos, drops, pubs, webOnly]);

  const [tab, setTab] = React.useState<Tab>(() => (lists.novedades.length ? 'novedades' : lists.precio.length ? 'precio' : 'pendientes'));
  const [q, setQ] = React.useState('');
  const [selected, setSelected] = React.useState<Vehicle | null>(null);
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [mobilePreview, setMobilePreview] = React.useState(false);
  const shown = React.useMemo(() => (q.trim() ? lists[tab].filter((v) => matchesSearch(v, q)) : lists[tab]), [lists, tab, q]);

  React.useEffect(() => {
    const stillThere = selected && shown.some((v) => normalizePatent(v.patente) === normalizePatent(selected.patente));
    if (!stillThere && shown[0]) setSelected(shown[0]);
  }, [shown, selected]);

  // ---------- Editor ----------
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [photo, setPhoto] = React.useState<HTMLImageElement | null>(null);
  const [photoSource, setPhotoSource] = React.useState<'web' | 'propia' | null>(null);
  const [photoTainted, setPhotoTainted] = React.useState(false);
  const [photoLoading, setPhotoLoading] = React.useState(false);
  const [variant, setVariant] = React.useState<'normal' | 'precio'>('normal');
  const [manualOldPrice, setManualOldPrice] = React.useState<number | ''>('');
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const drop = selected ? currentDrop(selected, drops) : null;
  const oldPrice = variant === 'precio' ? drop?.oldPrice || (manualOldPrice === '' ? null : manualOldPrice) : null;

  // Al cambiar de unidad: variante sugerida y foto de la web si existe
  React.useEffect(() => {
    if (!selected) return;
    setVariant(currentDrop(selected, drops) ? 'precio' : 'normal');
    setManualOldPrice('');
    setPhoto(null);
    setPhotoSource(null);
    setPhotoTainted(false);
    const url = selected.fotoPrincipal || selected.fotos?.[0];
    if (!url) return;
    let cancelled = false;
    setPhotoLoading(true);
    loadImage(url, true)
      .then((img) => {
        if (cancelled) return;
        setPhoto(img);
        setPhotoSource('web');
      })
      .catch(() =>
        // Sin permiso CORS: se muestra igual, pero para descargar hay que subir la foto
        loadImage(url, false)
          .then((img) => {
            if (cancelled) return;
            setPhoto(img);
            setPhotoSource('web');
            setPhotoTainted(true);
          })
          .catch(() => undefined)
      )
      .finally(() => !cancelled && setPhotoLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected, drops]);

  React.useEffect(() => {
    if (!selected || !canvasRef.current) return;
    let alive = true;
    ensureStoryFonts().then(() => alive && canvasRef.current && drawStory(canvasRef.current, selected, { photo, oldPrice }));
    return () => {
      alive = false;
    };
  }, [selected, photo, oldPrice]);

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      loadImage(String(reader.result), false).then((img) => {
        setPhoto(img);
        setPhotoSource('propia');
        setPhotoTainted(false);
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const downloadCurrent = async () => {
    if (!selected || !canvasRef.current) return;
    if (photoTainted) {
      onToast('La foto de la web no se puede usar directo. Guardala y subila con "Subir foto".', 'warn');
      return;
    }
    try {
      setBusy(true);
      const blob = await canvasToBlob(canvasRef.current);
      await downloadBlob(blob, storyFileName(selected, variant));
      publicationsService.markPublished(selected.patente);
      onToast('Historia descargada y marcada como publicada hoy.', 'success');
    } catch {
      onToast('No se pudo exportar la imagen. Probá subiendo la foto desde tu equipo.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  /** Descarga en tanda: usa la foto de la web cuando se puede; avisa cuáles faltan. */
  const downloadBatch = async () => {
    const targets = shown.filter((v) => checked.has(v.patente));
    if (!targets.length) return;
    setBusy(true);
    await ensureStoryFonts();
    const sinFoto: string[] = [];
    for (const v of targets) {
      const url = v.fotoPrincipal || v.fotos?.[0];
      let img: HTMLImageElement | null = null;
      if (url) img = await loadImage(url, true).catch(() => null);
      if (!img) {
        sinFoto.push(`${v.modelo} (${v.patente})`);
        continue;
      }
      const c = document.createElement('canvas');
      const d = currentDrop(v, drops);
      drawStory(c, v, { photo: img, oldPrice: d?.oldPrice });
      try {
        const blob = await canvasToBlob(c);
        await downloadBlob(blob, storyFileName(v, d ? 'precio' : 'normal'));
        publicationsService.markPublished(v.patente);
        await new Promise((r) => setTimeout(r, 400));
      } catch {
        sinFoto.push(`${v.modelo} (${v.patente})`);
      }
    }
    setBusy(false);
    setChecked(new Set());
    const ok = targets.length - sinFoto.length;
    onToast(
      sinFoto.length
        ? `Descargué ${ok} historia${ok === 1 ? '' : 's'}. Sin foto utilizable: ${sinFoto.join(', ')} — abrilas una por una y subí la foto.`
        : `Descargué ${ok} historia${ok === 1 ? '' : 's'}.`,
      sinFoto.length ? 'warn' : 'success'
    );
  };

  const TABS: { key: Tab; label: string; icon: React.ReactNode; hint: string }[] = [
    { key: 'novedades', label: 'Novedades', icon: <Sparkles className="w-3.5 h-3.5" />, hint: 'Ingresaron en los últimos 30 días' },
    { key: 'precio', label: 'Bajaron de precio', icon: <TrendingDown className="w-3.5 h-3.5" />, hint: 'Según las últimas importaciones del PDF' },
    { key: 'pendientes', label: 'Sin publicar', icon: <Clock className="w-3.5 h-3.5" />, hint: 'Nunca publicadas o hace 15 días o más' },
    { key: 'web', label: 'Solo en la web', icon: <Globe className="w-3.5 h-3.5" />, hint: 'Publicadas en autonet.com.ar que todavía no están en tu PDF de stock' },
    { key: 'todas', label: 'Todas', icon: <Megaphone className="w-3.5 h-3.5" />, hint: 'Todo el stock disponible' },
  ];

  const pubOf = (v: Vehicle) => pubs.get(normalizePatent(v.patente));

  return (
    <div className="space-y-4">
      <div className="lg:hidden">
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Publicidad</h1>
      </div>
      <p className="text-[13px] text-slate-500 -mt-2 lg:mt-0">Historias 1080×1920 para Instagram y estados de WhatsApp, con los datos de la unidad completos.</p>

      {/* Estado de la sincronización con autonet.com.ar */}
      {(() => {
        const hours = webCatalog ? (Date.now() - Date.parse(webCatalog.generatedAt)) / 3_600_000 : null;
        const old = hours === null || hours > 26 || webCatalog?.stale;
        // Lecturas automáticas: 8:15, 12:15, 16:15 y 20:15 (hora Argentina)
        const nextRun = (() => {
          const d = new Date();
          const mins = d.getHours() * 60 + d.getMinutes();
          const slot = [8, 12, 16, 20].map((h) => h * 60 + 15).find((m) => m > mins + 5);
          return slot ? `${Math.floor(slot / 60)}:15` : 'mañana 8:15';
        })();
        const ago =
          hours === null ? '' : hours < 1 ? 'hace menos de 1 hora' : hours < 24 ? `hace ${Math.floor(hours)} h` : `hace ${Math.floor(hours / 24)} día${hours >= 48 ? 's' : ''}`;
        return (
          <div
            className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 rounded-xl border text-[12.5px] ${
              old ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            {old ? <AlertTriangle className="w-4 h-4 text-amber-600" /> : <Globe className="w-4 h-4 text-emerald-600" />}
            {webCatalog ? (
              <span>
                Web de Autonet leída <strong className="text-slate-900">{ago}</strong> · {webCatalog.total} unidades publicadas · {webCatalog.conFoto} con foto · próxima lectura {nextRun}
                {lists.web.length > 0 && (
                  <>
                    {' '}
                    ·{' '}
                    <button type="button" onClick={() => setTab('web')} className="font-bold text-action-700 hover:underline">
                      {lists.web.length} todavía no están en tu stock
                    </button>
                  </>
                )}
              </span>
            ) : (
              <span>Todavía no hay datos de la web de Autonet. Se cargan solos después de la próxima publicación automática.</span>
            )}
            <button
              type="button"
              onClick={async () => {
                setRefreshing(true);
                const c = await webCatalogService.refresh();
                setRefreshing(false);
                onToast(
                  c
                    ? `Datos recargados (lectura de la web de las ${new Date(c.generatedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}). Para leer la web ya: GitHub → Actions → Run workflow.`
                    : 'Todavía no hay catálogo publicado.',
                  c ? 'success' : 'info'
                );
              }}
              className="ml-auto inline-flex items-center gap-1 text-[12px] font-bold text-action-700 hover:underline"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Recargar datos
            </button>
          </div>
        );
      })()}

      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.filter((t) => t.key !== 'web' || lists.web.length > 0).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setChecked(new Set());
            }}
            title={t.hint}
            className={`shrink-0 inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-xl text-[12.5px] font-bold border ${
              tab === t.key ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.icon}
            {t.label}
            <span className={`tabular text-[11px] px-1.5 py-0.5 rounded-md ${tab === t.key ? 'bg-white/15' : 'bg-slate-100 text-slate-500'}`}>{lists[t.key].length}</span>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-4 items-start">
        {/* Lista de unidades */}
        <div className="autonet-card overflow-hidden min-w-0">
          <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar unidad…" className="field pl-9" />
            </div>
            {checked.size > 0 && (
              <button type="button" onClick={downloadBatch} disabled={busy} className="btn btn-primary">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Descargar {checked.size}
              </button>
            )}
          </div>
          {shown.length === 0 ? (
            <div className="px-6 py-12 text-center text-[13px] text-slate-500">
              {tab === 'novedades'
                ? 'No hay ingresos nuevos en las importaciones de los últimos 30 días.'
                : tab === 'precio'
                ? 'Ninguna unidad bajó de precio en las últimas importaciones.'
                : 'No hay unidades en esta lista.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto scrollbar-thin">
              {shown.map((v) => {
                const p = pubOf(v);
                const d = currentDrop(v, drops);
                const active = selected && normalizePatent(selected.patente) === normalizePatent(v.patente);
                return (
                  <li key={v.patente} className={`flex items-center gap-3 px-3 py-2.5 ${active ? 'bg-action-50/70' : 'hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${v.modelo}`}
                      checked={checked.has(v.patente)}
                      onChange={(e) =>
                        setChecked((prev) => {
                          const n = new Set(prev);
                          e.target.checked ? n.add(v.patente) : n.delete(v.patente);
                          return n;
                        })
                      }
                      className="w-4 h-4 accent-[var(--color-action-600)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(v);
                        setMobilePreview(true);
                      }}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-bold text-slate-900 truncate">
                          {v.marca} {v.modelo} <span className="font-medium text-slate-500">{v.anio}</span>
                        </span>
                        <span className="block text-[11.5px] text-slate-500 truncate">
                          {v.patente} ·{' '}
                          {p ? `publicada hace ${daysSince(p.ultimaVez)} día${daysSince(p.ultimaVez) === 1 ? '' : 's'}` : 'nunca publicada'}
                          {!v.fotoPrincipal && !v.fotos?.length && ' · sin foto web'}
                        </span>
                      </span>
                      <span className="text-right shrink-0">
                        {d && <span className="block text-[11px] text-slate-400 line-through tabular">{formatCurrency(d.oldPrice)}</span>}
                        <span className={`block text-[13px] font-extrabold tabular ${d ? 'text-emerald-700' : 'text-slate-900'}`}>{formatCurrency(v.precio, v.moneda)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Vista previa y acciones (en el celular se abre como hoja a pantalla completa) */}
        {selected && (isDesktop || mobilePreview) && (
          <div
            className={
              isDesktop
                ? 'autonet-card p-4 space-y-3 lg:sticky lg:top-20'
                : 'fixed inset-0 z-50 bg-white overflow-y-auto p-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] space-y-3 anim-sheet'
            }
          >
            {!isDesktop && (
              <button type="button" onClick={() => setMobilePreview(false)} className="btn btn-sm btn-secondary">
                <X className="w-4 h-4" /> Volver a la lista
              </button>
            )}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[14px] font-extrabold text-slate-900 truncate">
                  {selected.marca} {selected.modelo} {selected.anio}
                </div>
                <div className="text-[12px] text-slate-500">{selected.patente}</div>
              </div>
              <div className="grid grid-cols-2 p-0.5 bg-slate-100 rounded-lg text-[11.5px] font-bold shrink-0">
                <button type="button" onClick={() => setVariant('normal')} className={`px-2.5 py-1 rounded-md ${variant === 'normal' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                  Normal
                </button>
                <button type="button" onClick={() => setVariant('precio')} className={`px-2.5 py-1 rounded-md ${variant === 'precio' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}>
                  Nuevo precio
                </button>
              </div>
            </div>

            {variant === 'precio' && !drop && (
              <div>
                <label className="field-label" htmlFor="story-old-price">Precio anterior (se muestra tachado)</label>
                <MoneyInput id="story-old-price" value={manualOldPrice} onChange={setManualOldPrice} placeholder="Ej. 32.000.000" />
              </div>
            )}

            <div className="relative mx-auto w-full max-w-[300px] aspect-[9/16] rounded-2xl overflow-hidden ring-1 ring-slate-200 bg-slate-100">
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              {photoLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="text-slate-500">Foto:</span>
              {photoSource === 'web' && (
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  <Globe className="w-3.5 h-3.5" /> web Autonet
                </span>
              )}
              {photoSource === 'propia' && (
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  <ImagePlus className="w-3.5 h-3.5" /> subida por vos
                </span>
              )}
              {!photoSource && !photoLoading && <span className="text-slate-400">sin foto</span>}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
              <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-sm btn-secondary ml-auto">
                <ImagePlus className="w-3.5 h-3.5" /> Subir foto
              </button>
              {photoSource && (
                <button type="button" onClick={() => { setPhoto(null); setPhotoSource(null); setPhotoTainted(false); }} className="btn btn-sm btn-ghost !px-1.5" title="Quitar foto">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {photoTainted && (
              <p className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                La web de Autonet no deja exportar esta foto. Usá tu foto mejorada con “Subir foto” para poder descargar la historia.
              </p>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={downloadCurrent} disabled={busy} className="btn btn-primary flex-1 !py-2.5">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Descargar historia
              </button>
              {pubOf(selected) ? (
                <button type="button" onClick={() => publicationsService.unmark(selected.patente)} className="btn btn-secondary" title="Desmarcar publicada">
                  <Undo2 className="w-4 h-4" />
                </button>
              ) : (
                <button type="button" onClick={() => publicationsService.markPublished(selected.patente)} className="btn btn-secondary" title="Marcar como publicada hoy">
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-[11.5px] text-slate-500 text-center">
              {pubOf(selected) ? `Publicada por última vez hace ${daysSince(pubOf(selected)!.ultimaVez)} días (${pubOf(selected)!.veces} vez/veces).` : 'Al descargarla queda marcada como publicada hoy.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
