import { ShoppingCart } from "lucide-react";

/** Provisoire : la liste de courses téléphone arrive au plan 3. */
export default function Courses() {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-12">
      <ShoppingCart size={40} className="text-cream-mute" aria-hidden="true" />
      <p className="text-lg text-cream">Les courses arrivent bientôt ici</p>
    </div>
  );
}
