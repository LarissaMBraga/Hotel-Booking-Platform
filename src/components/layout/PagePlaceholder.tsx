interface PagePlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PagePlaceholder({
  eyebrow,
  title,
  description,
}: PagePlaceholderProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] px-6 py-20">
      <section className="max-w-2xl text-center">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.3em] text-[#a88b5c]">
          {eyebrow}
        </p>
        <h1 className="font-editorial text-5xl leading-tight text-[#252a32] md:text-7xl">
          {title}
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-[#77766f]">
          {description}
        </p>
        <div className="mx-auto mt-10 h-px w-20 bg-[#c8b28c]" />
      </section>
    </main>
  );
}
