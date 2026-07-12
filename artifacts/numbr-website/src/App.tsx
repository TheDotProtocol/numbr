import { Switch, Route, Router as WouterRouter } from "wouter";
import Home from "./pages/Home";
import NotFound from "./pages/not-found";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tau-phone" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <div className="dark min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary">
          <Router />
        </div>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
