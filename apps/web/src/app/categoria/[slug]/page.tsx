// Página de una categoría: /categoria/laptops, con búsqueda opcional dentro (?q=) y sus filtros propios
// (?procesador=amd,intel&ram=16,32&precio_max=800). Solo la página sin filtros se indexa.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { EsqueletoRejilla } from '@/components/ofertas';
import { VistaCatalogo } from '@/components/catalogo-vista';
import { CATEGORIAS, categoria } from '@/lib/categorias';

export function generateStaticParams() {
  return CATEGORIAS.map(c => ({ slug: c.slug }));
}

export async function generateMetadata({ params, searchParams }: PageProps<'/categoria/[slug]'>): Promise<Metadata> {
  const cat = categoria((await params).slug);
  if (!cat) return { title: 'Categoría no encontrada' };
  const conFiltros = Object.keys(await searchParams).length > 0;
  return {
    title: cat.nombre,
    description: `Compare precios de ${cat.nombre.toLowerCase()} en tiendas online de Ecuador.`,
    // Cada combinación de filtros es una URL distinta: solo la categoría sin filtros se indexa.
    robots: conFiltros ? { index: false } : undefined,
  };
}

async function Resultados({ slug, searchParams }: { slug: string; searchParams: PageProps<'/categoria/[slug]'>['searchParams'] }) {
  const cat = categoria(slug)!;
  return <VistaCatalogo base={`/categoria/${cat.slug}`} cat={cat} sp={await searchParams} />;
}

export default async function PaginaCategoria({ params, searchParams }: PageProps<'/categoria/[slug]'>) {
  const { slug } = await params;
  // Con Cache Components no existe dynamicParams = false: un slug que no es una de las categorías es 404 aquí.
  if (!categoria(slug)) notFound();
  return (
    <Suspense fallback={<EsqueletoRejilla />}>
      <Resultados slug={slug} searchParams={searchParams} />
    </Suspense>
  );
}
