import Header from "./components/Header";
import TreeView from "./components/TreeView";
import Sidebar from "./components/Sidebar";
import { useTreeStore } from "./store/useTreeStore";
import { useTranslation } from "react-i18next";

function App() {
  const { people } = useTreeStore();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      <Header />

      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative">
          {people.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="text-center max-w-md">
                <h2 className="text-3xl font-bold mb-2 text-blue-900">
                  {t("welcome")}
                </h2>
                <p className="text-gray-600 mb-6 italic">"{t("tagline")}"</p>
                <p className="text-gray-600 mb-8">{t("welcomeDesc")}</p>
                <div className="flex flex-col gap-3">
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 text-left shadow-sm">
                    <strong>{t("tip").split(":")[0]}:</strong>
                    {t("tip").split(":")[1]}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <TreeView />
          )}
        </div>

        <Sidebar />
      </main>
    </div>
  );
}

export default App;
