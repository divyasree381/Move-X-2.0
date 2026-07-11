"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackagePlus, Power, Send, Trash2 } from "lucide-react";

import { Button, ErrorState, Input, Skeleton, StatusPill } from "@/components/ui";
import { createPartnerMenuItem, createPartnerStore, deletePartnerMenuItem, getPartnerStore, requestPartnerStoreApproval, setPartnerStoreOpen, updatePartnerMenuItem, updatePartnerStore, type PartnerStoreInput } from "@/lib/api";

const DEFAULT_STORE: PartnerStoreInput = { type: "FOOD", name: "", description: "", etaMinutes: 30, minOrder: 100, deliveryRadiusKm: 5, lat: 12.9716, lng: 77.5946, openingHours: { daily: "09:00-22:00" } };

export function StoreManagementPanel() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["partner-store"], queryFn: getPartnerStore, retry: false });
  const [form, setForm] = useState<PartnerStoreInput>(DEFAULT_STORE);
  const [item, setItem] = useState({ section: "Menu", name: "", description: "", price: "", stock: "-1" });
  useEffect(() => {
    const store = query.data?.store;
    if (store) setForm({ type: store.type as PartnerStoreInput["type"], name: store.name, description: store.description, imageUrl: store.imageUrl ?? undefined, etaMinutes: store.etaMinutes, minOrder: Number(store.minOrder), deliveryRadiusKm: Number(store.deliveryRadiusKm), lat: Number(store.lat), lng: Number(store.lng), openingHours: { daily: "09:00-22:00" } });
  }, [query.data?.store]);

  const refresh = () => client.invalidateQueries({ queryKey: ["partner-store"] });
  const save = useMutation({ mutationFn: () => query.data?.store ? updatePartnerStore(form) : createPartnerStore(form), onSuccess: refresh });
  const open = useMutation({ mutationFn: setPartnerStoreOpen, onSuccess: refresh });
  const approval = useMutation({ mutationFn: requestPartnerStoreApproval, onSuccess: refresh });
  const addItem = useMutation({ mutationFn: () => createPartnerMenuItem({ section: item.section, name: item.name, description: item.description, price: Number(item.price), stock: Number(item.stock) }), onSuccess: () => { setItem((value) => ({ ...value, name: "", description: "", price: "" })); refresh(); } });
  const updateItem = useMutation({ mutationFn: ({ id, available }: { id: string; available: boolean }) => updatePartnerMenuItem(id, { available }), onSuccess: refresh });
  const removeItem = useMutation({ mutationFn: deletePartnerMenuItem, onSuccess: refresh });

  if (query.isLoading) return <Skeleton className="h-72" />;
  if (query.isError) return <ErrorState title="Store workspace unavailable" description="We could not load your store workspace." />;
  const store = query.data?.store;
  const error = save.error ?? open.error ?? approval.error ?? addItem.error ?? updateItem.error ?? removeItem.error;

  return <section className="space-y-5 rounded-lg border border-border bg-surface p-4 shadow-sm" aria-labelledby="store-workspace-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-primary">Catalog</p><h2 id="store-workspace-title" className="text-xl font-bold text-foreground">Store workspace</h2></div>{store ? <StatusPill label={store.approval} tone={store.approval === "APPROVED" ? "success" : "warning"} /> : null}</div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <select className="min-h-10 rounded-md border border-border bg-surface px-3 text-sm" value={form.type} onChange={(event) => setForm((value) => ({ ...value, type: event.target.value as PartnerStoreInput["type"] }))}><option value="FOOD">Food</option><option value="GROCERY">Grocery</option><option value="PHARMACY">Pharmacy</option></select>
      <Input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Store name" />
      <Input type="number" value={form.etaMinutes} onChange={(event) => setForm((value) => ({ ...value, etaMinutes: Number(event.target.value) }))} placeholder="ETA minutes" />
      <Input type="number" value={form.minOrder} onChange={(event) => setForm((value) => ({ ...value, minOrder: Number(event.target.value) }))} placeholder="Minimum order" />
      <Input className="md:col-span-2" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="Store description" />
      <Input type="number" value={form.deliveryRadiusKm} onChange={(event) => setForm((value) => ({ ...value, deliveryRadiusKm: Number(event.target.value) }))} placeholder="Delivery radius km" />
      <Input value={form.imageUrl ?? ""} onChange={(event) => setForm((value) => ({ ...value, imageUrl: event.target.value || undefined }))} placeholder="Store image URL" />
    </div>
    <div className="flex flex-wrap gap-2"><Button disabled={save.isPending || form.name.length < 2 || form.description.length < 10} onClick={() => save.mutate()}>{store ? "Save store" : "Create store"}</Button>{store ? <><Button variant="secondary" disabled={approval.isPending} onClick={() => approval.mutate()}><Send className="size-4" /> Request review</Button><Button variant="secondary" disabled={open.isPending || store.approval !== "APPROVED"} onClick={() => open.mutate(!store.isOpen)}><Power className="size-4" /> {store.isOpen ? "Close store" : "Open store"}</Button></> : null}</div>
    {store ? <div className="border-t border-border pt-5"><h3 className="font-semibold text-foreground">Menu and stock</h3><div className="mt-3 grid gap-2 md:grid-cols-5"><Input value={item.section} onChange={(e) => setItem((v) => ({ ...v, section: e.target.value }))} placeholder="Section"/><Input value={item.name} onChange={(e) => setItem((v) => ({ ...v, name: e.target.value }))} placeholder="Item name"/><Input value={item.description} onChange={(e) => setItem((v) => ({ ...v, description: e.target.value }))} placeholder="Description"/><Input type="number" value={item.price} onChange={(e) => setItem((v) => ({ ...v, price: e.target.value }))} placeholder="Price"/><Button disabled={addItem.isPending || item.name.length < 2 || item.description.length < 5 || Number(item.price) < 0} onClick={() => addItem.mutate()}><PackagePlus className="size-4"/> Add item</Button></div><div className="mt-3 divide-y divide-border">{query.data?.menu.map((menuItem) => <div key={menuItem.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-medium text-foreground">{menuItem.name}</p><p className="text-xs text-muted-foreground">{menuItem.section} · Rs {Number(menuItem.price).toFixed(0)} · Stock {menuItem.stock === -1 ? "Unlimited" : menuItem.stock}</p></div><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => updateItem.mutate({ id: menuItem.id, available: !menuItem.available })}>{menuItem.available ? "Pause" : "Resume"}</Button><Button size="icon" variant="ghost" aria-label={`Delete ${menuItem.name}`} onClick={() => removeItem.mutate(menuItem.id)}><Trash2 className="size-4 text-destructive"/></Button></div></div>)}</div></div> : null}
    {error ? <p className="text-sm text-destructive" role="status">{error instanceof Error ? error.message : "Store update failed"}</p> : null}
  </section>;
}
