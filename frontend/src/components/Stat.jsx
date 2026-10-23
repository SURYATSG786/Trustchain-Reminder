import React, { useState, useEffect } from "react";

import { Icon } from "../components/Icon.jsx";
export function Stat({ title, value, detail, icon, color = "", onClick }) {
  return (
    <button
      className={"stat " + color}
      data-tone={color || "blue"}
      onClick={onClick}
      disabled={!onClick}
    >
      <div>
        <span>{title}</span>
        <span className={"stat-icon " + color}>
          <Icon name={icon} size={19} />
        </span>
      </div>
      <b>{value}</b>
      <small>{detail}</small>
    </button>
  );
}
