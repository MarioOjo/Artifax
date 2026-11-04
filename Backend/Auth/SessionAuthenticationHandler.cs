using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Options;

namespace Artifax.Auth
{
    // Turns the server-side session that UserController fills in after password + 2FA into a
    // ClaimsPrincipal, so the standard [Authorize]/[AllowAnonymous] attributes and the global
    // fallback policy can protect endpoints. A pending 2FA login (password only) is not signed in.
    public class SessionAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public const string SchemeName = "Session";

        public SessionAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            // UseSession must run before UseAuthentication; without it there is nothing to read
            if (Context.Features.Get<ISessionFeature>()?.Session is not { } session)
                return Task.FromResult(AuthenticateResult.NoResult());

            var email = session.GetString("UserEmail");
            var level = session.GetString("UserLevel");
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(level))
                return Task.FromResult(AuthenticateResult.NoResult());

            var identity = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.Email, email),
                new Claim(ClaimTypes.Name, session.GetString("Username") ?? email),
                new Claim(ClaimTypes.Role, level),
            }, SchemeName);

            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
        }
    }
}
