import React, { useEffect, useState } from 'react';
import { STSClient, GetCallerIdentityCommand, GetCallerIdentityCommandOutput } from "@aws-sdk/client-sts";
import { SSOOIDCClient, RegisterClientCommand, StartDeviceAuthorizationCommand, CreateTokenCommand } from "@aws-sdk/client-sso-oidc";
import { SSOClient, ListAccountsCommand, ListAccountRolesCommand, GetRoleCredentialsCommand, ListAccountRolesCommandOutput } from "@aws-sdk/client-sso";
import { FetchHttpHandler } from './lib/custom-fetch-client'
import { SsoConfig } from './App';

const fetchHandler = new FetchHttpHandler({})

interface AccountEntry {
  accountId: string;
  accountName: string;
  emailAddress: string;
}

const Account = ({ region, accountId, accountName, emailAddress }: AccountEntry & {region: string}) => {
  const [rolesResult, setRolesResult] = useState<ListAccountRolesCommandOutput>()
  const [identity, setIdentity] = useState<GetCallerIdentityCommandOutput>()
  const getRoles = async () => {
    const accessToken = localStorage.getItem('accessToken')!;
    const ssoClient = new SSOClient({ region, requestHandler: fetchHandler });

    const rolesResult = await ssoClient.send(new ListAccountRolesCommand({
      accessToken: accessToken,
      accountId,
    }))

    setRolesResult(rolesResult);

    const credentialsResponse = await ssoClient.send(new GetRoleCredentialsCommand({
      accessToken: accessToken,
      accountId: rolesResult.roleList![0].accountId!,
      roleName: rolesResult.roleList![0].roleName!,
    }))

    const credentials = credentialsResponse.roleCredentials!;

    const stsClient = new STSClient({ region, credentials: { accessKeyId: credentials.accessKeyId!, secretAccessKey: credentials.secretAccessKey!, sessionToken: credentials.sessionToken! }});
    const identityResult = await stsClient.send(new GetCallerIdentityCommand({}));

    setIdentity(identityResult);
  }


  return (
    <div onClick={getRoles}>
      <div>AccountId: {accountId}</div>
      <div>AccountName: {accountName}</div>
      { identity && <div>Identity: {identity.Arn} - {identity.UserId}</div> }
    </div>
  )
}

const Auth = ({ ssoUrl, region }: SsoConfig) => {
  const [needsAuthentication, setNeedsAuthentication] = useState(true);
  const [fullSsoUrl, setFullSsoUrl] = React.useState<string>();
  const [accounts, setAccounts] = React.useState<AccountEntry[]>([]);

  console.log({ssoUrl, region})
  useEffect(() => {
    const doStuff = async () => {
      const client = new SSOOIDCClient({ region, requestHandler: fetchHandler });

      let accessToken = localStorage.getItem('accessToken');

      if (accessToken) {
        setNeedsAuthentication(false);
        return accessToken;
      }

      let clientId = localStorage.getItem('clientId');
      let clientSecret = localStorage.getItem('clientSecret');
      const command = new RegisterClientCommand({
        clientName: "my-client",
        clientType: "public",
        scopes: ["openid", "sso-portal:*"],
      });

      const clientResponse = await client.send(command);

      localStorage.setItem('clientId', clientResponse.clientId!);
      localStorage.setItem('clientSecret', clientResponse.clientSecret!);
      clientSecret = clientResponse.clientSecret!;
      clientId = clientResponse.clientId!;

      const command2 = new StartDeviceAuthorizationCommand({
        clientId: clientId!,
        clientSecret: clientSecret!,
        startUrl: ssoUrl
      });

      const deviceResponse = await client.send(command2);
      setFullSsoUrl(deviceResponse.verificationUriComplete);
      console.log({verificationUriComplete: deviceResponse.verificationUriComplete});
      const deviceCode = deviceResponse.deviceCode!;

      // poll with the interval until the user has authorized the client.
      while (true) {
        const command3 = new CreateTokenCommand({
          clientId: clientId!,
          clientSecret: clientSecret!,
          deviceCode: deviceCode,
          grantType: "urn:ietf:params:oauth:grant-type:device_code",
        });

        try {
          const { accessToken, expiresIn } = await client.send(command3);
          localStorage.setItem('accessToken', accessToken!);
          setNeedsAuthentication(false);
          return accessToken;
        } catch (error: any) {
          // if (error.code === "authorization_pending") {
            // sleep for interval seconds.
            console.log(error.error);
            await new Promise(resolve => setTimeout(resolve, (1) * 1000));
          // } else {
          //   console.log(error);
          //   break;
          // }
        }
      }
    }
    doStuff().then(async (accessToken) => {
      const ssoClient = new SSOClient({ region, requestHandler: fetchHandler });
      const result = await ssoClient.send(new ListAccountsCommand({
        accessToken: accessToken
      }));

      setAccounts(result.accountList!.map(account => ({
        accountId: account.accountId!,
        accountName: account.accountName!,
        emailAddress: account.emailAddress!
      })));
    }).catch(error => {
      console.log(error);
    });
  }, []);

  if (needsAuthentication) {
    return <div>
      <h1>
        <a href={fullSsoUrl} target="_blank">Click here to authenticate</a>
      </h1>
    </div>;
  }

  return (
    <>
    <h1>
      Accounts
    </h1>
    <ul role="list" className="space-y-3">
      {accounts.map(account => (
        <li key={account.accountId}  className="bg-white shadow overflow-hidden rounded-md px-6 py-4">
          <Account region={region} accountId={account.accountId} accountName={account.accountName} emailAddress={account.emailAddress}/>
        </li>
      ))}
    </ul>
    </>
  );
};

export default Auth;