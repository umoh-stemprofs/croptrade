export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1280px] flex-col justify-center gap-4 px-6">
      <h1 className="text-[32px] font-bold leading-10">CropTrade</h1>
      <p className="text-lg leading-7 text-muted">
        What is my crop worth abroad?
      </p>
      <p className="text-sm leading-5 text-muted">
        Step 1 complete: database schema and seed are set up. Screens come in
        the next step.
      </p>
      <p className="text-sm leading-5 text-info">
        Decision-support tool. You decide.
      </p>
    </main>
  );
}
