import React, { useState, useEffect } from "react";

import { Icon } from "../components/Icon.jsx";
export function Empty({ title, detail }) {
  return (
    <div className="empty">
      <span className="empty-symbol">
        <Icon name="file" size={27} />
      </span>
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
