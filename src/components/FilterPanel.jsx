import { useState } from "react";
import { CAUCUSES, PARTIES, STATE_NAMES } from "../constants";
import { facetOptions, hasActiveFilters } from "../lib/filters";
import { Check, ChevronDown } from "./Icons";
import "./FilterPanel.css";

function FacetSection({ title, facet, options, selected, onToggle, onClear, describe }) {
  const [collapsed, setCollapsed] = useState(false);
  const id = `facet-${facet}`;

  return (
    <section className="facet">
      <div className="facet-head">
        <button
          type="button"
          className="facet-title"
          aria-expanded={!collapsed}
          aria-controls={id}
          onClick={() => setCollapsed((value) => !value)}
        >
          {title}
          <ChevronDown width={14} height={14} className={collapsed ? "collapsed" : ""} />
        </button>
        {selected.length > 0 && (
          <button type="button" className="facet-clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {!collapsed && (
        <ul className="facet-list" id={id}>
          {options.map(({ value, count }) => {
            const isOn = selected.includes(value);
            const { label, detail, swatch } = describe(value);
            return (
              <li key={value}>
                <button
                  type="button"
                  className={`facet-row${isOn ? " on" : ""}${count === 0 && !isOn ? " is-empty" : ""}`}
                  aria-pressed={isOn}
                  onClick={() => onToggle(facet, value)}
                >
                  <span className="facet-check" aria-hidden="true">
                    {isOn && <Check width={12} height={12} strokeWidth={2.6} />}
                  </span>
                  {swatch && <span className={`facet-swatch ${swatch}`} aria-hidden="true" />}
                  <span className="facet-label">
                    {label}
                    {detail && <span className="facet-detail">{detail}</span>}
                  </span>
                  <span className="facet-count">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FilterPanel({ members, filters, ctx, countCtx, labels, onToggle, onClearFacet, onClearAll }) {
  const sections = [
    {
      facet: "position",
      title: "Position",
      describe: (value) => ({ label: labels[value], swatch: `vote-${value}` }),
    },
    {
      facet: "party",
      title: "Party",
      describe: (value) => ({ label: PARTIES[value]?.name ?? value, swatch: `party-${value}` }),
    },
    {
      facet: "caucus",
      title: "Caucus",
      describe: (value) => ({ label: value, detail: CAUCUSES[value]?.name }),
    },
    {
      facet: "state",
      title: "State",
      describe: (value) => ({ label: STATE_NAMES[value] ?? value, detail: value }),
    },
  ];

  return (
    <div className="filter-panel">
      <div className="filter-panel-head">
        <h2>Filters</h2>
        {hasActiveFilters(filters) && (
          <button type="button" className="link-button" onClick={onClearAll}>
            Clear all
          </button>
        )}
      </div>
      {sections.map((section) => (
        <FacetSection
          key={section.facet}
          {...section}
          options={facetOptions(members, filters, ctx, section.facet, countCtx)}
          selected={filters[section.facet]}
          onToggle={onToggle}
          onClear={() => onClearFacet(section.facet)}
        />
      ))}
    </div>
  );
}

export default FilterPanel;
