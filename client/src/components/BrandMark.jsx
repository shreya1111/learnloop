import { Link } from "react-router-dom";

export default function BrandMark() {
  return (
    <Link
      aria-label="LearnLoop home"
      className="inline-flex w-fit items-center gap-2 border-2 border-black bg-brand px-2.5 py-1.5 text-black"
      to="/"
    >
      <span className="grid size-6 place-items-center bg-black font-display text-[11px] leading-none text-brand">
        LL
      </span>
      <span className="font-display text-sm uppercase tracking-[-0.04em]">
        LearnLoop
      </span>
    </Link>
  );
}
