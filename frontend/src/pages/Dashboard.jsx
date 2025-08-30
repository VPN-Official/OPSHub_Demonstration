import React from "react";
import ReactECharts from "echarts-for-react";

export default function Dashboard() {
  const option = {
    title: { text: "SLA Compliance", left: "center" },
    series: [{ type: "gauge", data: [{ value: 84, name: "SLA Met" }] }]
  };
  return <ReactECharts option={option} style={{ height: "300px" }} />;
}
