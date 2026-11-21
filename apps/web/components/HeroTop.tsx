import { HOME_BOROUGH, OTHER_BOROUGHS } from "@/lib/boroughList";
import { COVERED } from "@/lib/places";
import { BoroughPicker } from "./BoroughPicker";
import { PostcodeFinder } from "./PostcodeFinder";
import { YourWard } from "./YourWard";

/** The top of a council's page: your postcode first, which opens your council and ward; or pick a place from the list;
 *  and that the project is not the council. */
export function HeroTop({
  current,
  council,
  example,
  results = true,
  children,
}: {
  current: string;
  council: string;
  example: string;
  /** Whether the page shows how each ward voted (not where the counts are unpublished, as in Glasgow). */
  results?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="hero-top">
      <div className="hero-switch">
        <PostcodeFinder covered={COVERED} example={example} here={current} label="Start with your postcode" compact />
        <div className="hero-or">
          <span>or choose</span>
          <BoroughPicker current={current} boroughs={[HOME_BOROUGH, ...OTHER_BOROUGHS]} />
        </div>
      </div>
      <YourWard current={current} results={results} />
      <p className="indep">
        Independent. Not run by or affiliated with {council}.{children ? <> {children}</> : null}
      </p>
    </div>
  );
}
