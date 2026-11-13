'use client';
import dynamic from 'next/dynamic';
const ThreeDShowcase = dynamic(() => import('./ThreeDShowcase'), { ssr: false });
export default function ShowcaseClient() { return <ThreeDShowcase />; }