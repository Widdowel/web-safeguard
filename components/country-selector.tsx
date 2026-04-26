"use client";

import { useId, useMemo, useState } from "react";
import { COUNTRIES, ECOWAS_CODES, type Country } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Group = Country["group"];
const GROUPS: Group[] = ["ECOWAS", "Afrique", "Hors Afrique"];
const GROUP_LABEL: Record<Group, string> = {
  ECOWAS: "CEDEAO",
  Afrique: "Autre Afrique",
  "Hors Afrique": "Hors Afrique",
};

type ControlledProps = {
  name?: string;
  worldwideHint?: string;
  value: readonly string[];
  onChange: (selected: string[]) => void;
  defaultSelected?: never;
};

type UncontrolledProps = {
  name?: string;
  worldwideHint?: string;
  defaultSelected?: readonly string[];
  value?: never;
  onChange?: never;
};

export type CountrySelectorProps = ControlledProps | UncontrolledProps;

export function CountrySelector(props: CountrySelectorProps) {
  const {
    name = "countries",
    worldwideHint = "Aucun pays sélectionné = blocage mondial",
  } = props;

  const id = useId();
  const isControlled = "value" in props && props.value !== undefined;
  const [internalSelected, setInternalSelected] = useState<Set<string>>(
    new Set(props.defaultSelected ?? []),
  );
  const selected = isControlled ? new Set(props.value) : internalSelected;

  const apply = (next: Set<string>) => {
    if (isControlled) {
      props.onChange?.([...next]);
    } else {
      setInternalSelected(next);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<Group, Country[]>();
    for (const g of GROUPS) map.set(g, []);
    for (const c of COUNTRIES) map.get(c.group)?.push(c);
    return map;
  }, []);

  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    apply(next);
  };

  return (
    <div className="space-y-3">
      {!isControlled &&
        [...selected].map((code) => (
          <input key={code} type="hidden" name={name} value={code} />
        ))}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Préréglages :</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => apply(new Set(ECOWAS_CODES))}
        >
          CEDEAO complet
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => apply(new Set(["BJ"]))}
        >
          Bénin uniquement
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => apply(new Set())}>
          Tout désélectionner
        </Button>
        <span className="ml-auto text-muted-foreground">{selected.size} pays</span>
      </div>

      <div className="space-y-3 rounded-md border bg-card p-3">
        {GROUPS.map((group) => {
          const countries = grouped.get(group) ?? [];
          return (
            <fieldset key={group}>
              <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {GROUP_LABEL[group]}
              </legend>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {countries.map((c) => {
                  const checked = selected.has(c.code);
                  return (
                    <label
                      key={c.code}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-xs transition-colors",
                        checked
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input hover:bg-accent",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-3.5 accent-primary"
                        checked={checked}
                        onChange={() => toggle(c.code)}
                        id={`${id}-${c.code}`}
                      />
                      <span className="font-mono">{c.code}</span>
                      <span className="truncate">{c.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{worldwideHint}</p>
    </div>
  );
}
