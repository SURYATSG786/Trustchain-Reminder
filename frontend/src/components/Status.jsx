import React, { useState, useEffect } from "react";

export function Status({ value }) {
  return (
    <span className={"status " + value.toLowerCase().replace(" ", "-")}>
      <i />
      {value}
    </span>
  );
}
