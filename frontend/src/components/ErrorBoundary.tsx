// File overview: Reusable UI component logic for components/ErrorBoundary.tsx.
import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Button, Typography } from "@mui/material";

type Props = { children: ReactNode };

type State = { hasError: boolean; message: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || "Something went wrong." };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            px: 2,
            bgcolor: "background.default",
          }}
        >
          <Typography variant="h5" component="h1">
            This screen crashed
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 480, textAlign: "center" }}>
            {this.state.message}
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload the app
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
