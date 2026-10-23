import React, { useState, useEffect } from "react";

export function Field({ label, wide, children }) {
  return (
    <label className={wide ? "col-span-2" : ""}>
      {label}
      {children}
    </label>
  );
}
