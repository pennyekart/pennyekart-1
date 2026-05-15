import logo from "@/assets/logo.png";
import carbsLogo from "@/assets/carbs-logo.png";
import { Wrench } from "lucide-react";

interface Props {
  selected: string;
  onSelect: (id: string) => void;
}

const PlatformSelector = ({ selected, onSelect }: Props) =>
<div className="bg-primary">
    <div className="container flex items-center justify-between gap-1 py-2 sm:gap-2 text-cyan-600">
      {/* Pennyekart */}
      <button
      onClick={() => onSelect("pennyekart")}
      className={`flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:gap-2 sm:px-4 sm:py-2 sm:text-sm ${
      selected === "pennyekart" ?
      "bg-card text-foreground shadow-sm" :
      "bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"}`
      }>

        <img src={logo} alt="Pennyekart" className="h-7 shrink-0 sm:h-8" />
      </button>

      {/* Penny Carbs */}
      <button
      onClick={() => onSelect("pennycarbs")}
      className={`flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:gap-2 sm:px-4 sm:py-2 sm:text-sm ${
      selected === "pennycarbs" ?
      "bg-card text-foreground shadow-sm" :
      "bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"}`
      }>

        <img src={carbsLogo} alt="Penny Carbs" className="h-4 shrink-0 sm:h-5" />
        <span className="whitespace-nowrap">Food Delivery</span>
      </button>

      {/* Penny Services */}
      <button
      onClick={() => onSelect("pennyservices")}
      className={`flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:gap-2 sm:px-4 sm:py-2 sm:text-sm ${
      selected === "pennyservices" ?
      "bg-card text-foreground shadow-sm" :
      "bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"}`
      }>

        <Wrench className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
        <span className="whitespace-nowrap">Services</span>
      </button>
    </div>
  </div>;


export default PlatformSelector;