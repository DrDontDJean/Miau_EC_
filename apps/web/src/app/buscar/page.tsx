import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EsqueletoRejilla } from '@/components/ofertas';
import { VistaCatalogo } from '@/components/catalogo-vista';

export const metadata: Metadata = { title: 'Buscar', robots: { index: false } };

async function Resultados({ searchParams }: { searchParams: PageProps<'/buscar'>['searchParams'] }) {
  return <VistaCatalogo base="/buscar" cat={null} sp={await searchParams} />;
}

export default function Buscar(props: PageProps<'/buscar'>) {
  return (
    <Suspense fallback={<EsqueletoRejilla />}>
      <Resultados searchParams={props.searchParams} />
    </Suspense>
  );
}
