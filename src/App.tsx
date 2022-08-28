import { useState } from "react";
import "./App.css";
import regions from "./lib/aws-regions";
import Auth from "./Auth";

export interface SsoConfig {
  region: string;
  ssoUrl: string;
}

function App() {
  const [ssoConfig, setSsoConfig] = useState<SsoConfig>({
    region: regions[10],
    ssoUrl: ''
  });

  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setSsoConfig({...ssoConfig, [name]: value });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    console.log('submitted');
    return <Auth region={ssoConfig.region} ssoUrl={ssoConfig.ssoUrl} />;
  }

  return (
    <>
      <div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <img
            className="mx-auto h-12 w-auto"
            src="https://tailwindui.com/img/logos/workflow-mark.svg?color=indigo&shade=600"
            alt="Workflow"
          />
          <h2 className="mt-6 text-center text-3xl tracking-tight font-bold text-gray-900">
            Select your AWS SSO Config
          </h2>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form className="space-y-6" action="#" method="POST" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  SSO URL
                </label>
                <div className="mt-1">
                  <input
                    id="ssoUrl"
                    name="ssoUrl"
                    type="text"
                    value={ssoConfig?.ssoUrl}
                    onChange={handleInputChange}
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  AWS Region
                </label>
                <div className="mt-1">
                  <select
                    id="region"
                    name="region"
                    value={ssoConfig?.region}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                  </select>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Start Login
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
