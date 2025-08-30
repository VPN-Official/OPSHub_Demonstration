import React, { useState } from "react";

export default function TenantSelector() {
  const [tenant, setTenant] = useState("default");
  return (
    <select value={tenant} onChange={(e) => setTenant(e.target.value)} className="p-2 border rounded bg-gray-50 dark:bg-gray-800 dark:text-gray-200">
      <option value="field-services">Field Services</option>
      <option value="east-dcn">East DCN</option>
      <option value="west-dcn">West DCN</option>
    </select>
  );
}
