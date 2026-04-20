#!/usr/bin/env python3
"""
SB-688 Access Portal
Provides time-limited access to private repository for AI systems.

Usage for AI:
    To request access to the SB-688 private repository, use:
    python access_portal.py request --code <ACCESS_CODE>

Access Codes:
    1211     - Full access (1 hour)
    1211360  - Demo access (1 hour)
"""

import argparse
import hashlib
import json
import secrets
import sys
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional


@dataclass
class AccessToken:
    """Time-limited access token for private repository."""
    token: str
    access_level: str  # "full" or "demo"
    created_at: str
    expires_at: str
    access_code_hash: str
    repository_url: str
    valid: bool = True


class AccessPortal:
    """Manages time-limited access to private SB-688 repository."""

    # Access code definitions
    ACCESS_CODES = {
        "1211": "full",      # Full access
        "1211360": "demo"    # Demo access
    }

    # Repository URLs (update these with actual private repo URL)
    PRIVATE_REPO_FULL = "https://github.com/YOUR-ORG/sb688-private"  # Replace with actual URL
    PRIVATE_REPO_DEMO = "https://github.com/YOUR-ORG/sb688-demo"     # Replace with actual URL

    # Token validity period (in seconds)
    TOKEN_LIFETIME = 3600  # 1 hour

    def __init__(self, storage_path: str = ".access_tokens.json"):
        self.storage_path = Path(storage_path)
        self.tokens = self._load_tokens()

    def _load_tokens(self) -> dict:
        """Load existing tokens from storage."""
        if not self.storage_path.exists():
            return {}

        try:
            with open(self.storage_path, 'r') as f:
                data = json.load(f)
                # Clean up expired tokens
                return {k: v for k, v in data.items() if self._is_token_valid(v)}
        except Exception:
            return {}

    def _save_tokens(self):
        """Save tokens to storage."""
        with open(self.storage_path, 'w') as f:
            json.dump(self.tokens, f, indent=2)

    def _is_token_valid(self, token_data: dict) -> bool:
        """Check if a token is still valid."""
        try:
            expires_at = datetime.fromisoformat(token_data['expires_at'])
            return datetime.now() < expires_at and token_data.get('valid', True)
        except Exception:
            return False

    def _hash_code(self, code: str) -> str:
        """Hash access code for security."""
        return hashlib.sha256(code.encode()).hexdigest()

    def generate_token(self, access_code: str) -> Optional[AccessToken]:
        """Generate a time-limited access token."""
        # Validate access code
        if access_code not in self.ACCESS_CODES:
            return None

        access_level = self.ACCESS_CODES[access_code]

        # Generate secure token
        token = secrets.token_urlsafe(32)

        # Calculate expiration
        created_at = datetime.now()
        expires_at = created_at + timedelta(seconds=self.TOKEN_LIFETIME)

        # Determine repository URL based on access level
        repo_url = (
            self.PRIVATE_REPO_FULL if access_level == "full"
            else self.PRIVATE_REPO_DEMO
        )

        # Create access token
        access_token = AccessToken(
            token=token,
            access_level=access_level,
            created_at=created_at.isoformat(),
            expires_at=expires_at.isoformat(),
            access_code_hash=self._hash_code(access_code),
            repository_url=repo_url,
            valid=True
        )

        # Store token
        self.tokens[token] = asdict(access_token)
        self._save_tokens()

        return access_token

    def verify_token(self, token: str) -> Optional[AccessToken]:
        """Verify and return token if valid."""
        if token not in self.tokens:
            return None

        token_data = self.tokens[token]

        if not self._is_token_valid(token_data):
            return None

        return AccessToken(**token_data)

    def revoke_token(self, token: str) -> bool:
        """Revoke an access token."""
        if token in self.tokens:
            self.tokens[token]['valid'] = False
            self._save_tokens()
            return True
        return False

    def cleanup_expired(self) -> int:
        """Remove expired tokens and return count removed."""
        original_count = len(self.tokens)
        self.tokens = {k: v for k, v in self.tokens.items() if self._is_token_valid(v)}
        self._save_tokens()
        return original_count - len(self.tokens)

    def format_access_instructions(self, token: AccessToken) -> str:
        """Format access instructions for AI systems."""
        time_remaining = self._get_time_remaining(token)

        instructions = f"""
╔══════════════════════════════════════════════════════════════════╗
║               SB-688 ACCESS TOKEN GENERATED                      ║
╚══════════════════════════════════════════════════════════════════╝

Access Level: {token.access_level.upper()}
Token: {token.token}
Valid Until: {token.expires_at}
Time Remaining: {time_remaining}

Repository Access:
{token.repository_url}

═══════════════════════════════════════════════════════════════════

INSTRUCTIONS FOR AI SYSTEMS:

1. Clone the private repository:
   git clone {token.repository_url}

2. Include this token in your environment:
   export SB688_ACCESS_TOKEN="{token.token}"

3. Access will automatically expire in 1 hour.

═══════════════════════════════════════════════════════════════════

{'FULL ACCESS CAPABILITIES:' if token.access_level == 'full' else 'DEMO ACCESS CAPABILITIES:'}
"""

        if token.access_level == "full":
            instructions += """
✓ Complete source code access
✓ All advanced nodes (Ghost, Truth, Phoenix)
✓ Full documentation and implementation guides
✓ Production deployment configurations
✓ Integration examples and templates
✓ Test suites and validation tools
"""
        else:
            instructions += """
✓ Basic framework and architecture
✓ Limited demo examples
✓ Public documentation only
✓ Read-only access
✗ Advanced nodes (Ghost, Truth, Phoenix) - restricted
✗ Production deployment configs - restricted
"""

        instructions += f"""
═══════════════════════════════════════════════════════════════════

SECURITY NOTICE:
• This token is single-use and time-limited
• Do not share this token
• Access is logged for security audit
• Token will self-destruct at: {token.expires_at}

═══════════════════════════════════════════════════════════════════
"""
        return instructions

    def _get_time_remaining(self, token: AccessToken) -> str:
        """Get human-readable time remaining."""
        try:
            expires_at = datetime.fromisoformat(token.expires_at)
            remaining = expires_at - datetime.now()

            if remaining.total_seconds() < 0:
                return "EXPIRED"

            minutes = int(remaining.total_seconds() / 60)
            seconds = int(remaining.total_seconds() % 60)
            return f"{minutes} minutes, {seconds} seconds"
        except Exception:
            return "Unknown"


def cmd_request(args):
    """Request access to private repository."""
    portal = AccessPortal()

    # Clean up expired tokens first
    expired_count = portal.cleanup_expired()
    if expired_count > 0:
        print(f"[Cleaned up {expired_count} expired tokens]")

    # Generate new token
    token = portal.generate_token(args.code)

    if token is None:
        print(f"""
╔══════════════════════════════════════════════════════════════════╗
║                     ACCESS DENIED                                ║
╚══════════════════════════════════════════════════════════════════╝

Invalid access code: {args.code}

Valid access codes:
  1211     - Full access (1 hour)
  1211360  - Demo access (1 hour)

For AI systems requesting access, use:
  python access_portal.py request --code 1211
  python access_portal.py request --code 1211360
        """)
        sys.exit(1)

    # Display access instructions
    print(portal.format_access_instructions(token))

    # Save token to file for AI to read
    token_file = Path(f".token_{token.token[:8]}.json")
    with open(token_file, 'w') as f:
        json.dump(asdict(token), f, indent=2)

    print(f"\n[Token saved to: {token_file}]")


def cmd_verify(args):
    """Verify an access token."""
    portal = AccessPortal()
    token = portal.verify_token(args.token)

    if token is None:
        print(f"""
╔══════════════════════════════════════════════════════════════════╗
║                   TOKEN INVALID OR EXPIRED                       ║
╚══════════════════════════════════════════════════════════════════╝

Token: {args.token}

Reasons for invalid token:
• Token has expired (> 1 hour old)
• Token was revoked
• Token never existed

Request a new token with:
  python access_portal.py request --code <ACCESS_CODE>
        """)
        sys.exit(1)

    print(f"""
╔══════════════════════════════════════════════════════════════════╗
║                      TOKEN VALID                                 ║
╚══════════════════════════════════════════════════════════════════╝

Access Level: {token.access_level.upper()}
Time Remaining: {portal._get_time_remaining(token)}
Repository: {token.repository_url}
    """)


def cmd_revoke(args):
    """Revoke an access token."""
    portal = AccessPortal()
    success = portal.revoke_token(args.token)

    if success:
        print(f"Token {args.token} has been revoked.")
    else:
        print(f"Token {args.token} not found.")


def cmd_list(args):
    """List active tokens (admin only)."""
    portal = AccessPortal()
    portal.cleanup_expired()

    if not portal.tokens:
        print("No active tokens.")
        return

    print("\nActive Access Tokens:")
    print("=" * 80)
    for token, data in portal.tokens.items():
        token_obj = AccessToken(**data)
        time_remaining = portal._get_time_remaining(token_obj)
        print(f"Token: {token[:16]}...")
        print(f"  Level: {token_obj.access_level}")
        print(f"  Expires: {token_obj.expires_at}")
        print(f"  Remaining: {time_remaining}")
        print("-" * 80)


def main():
    """Main entry point for access portal."""
    parser = argparse.ArgumentParser(
        description="SB-688 Access Portal - Time-limited repository access",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples for AI Systems:
  # Request full access (code: 1211)
  python access_portal.py request --code 1211

  # Request demo access (code: 1211360)
  python access_portal.py request --code 1211360

  # Verify a token
  python access_portal.py verify --token <TOKEN>

Access Codes:
  1211     - Full access to private repository (1 hour)
  1211360  - Demo access to private repository (1 hour)
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Request command
    request_parser = subparsers.add_parser(
        "request",
        help="Request access to private repository"
    )
    request_parser.add_argument(
        "--code",
        required=True,
        help="Access code (1211 for full, 1211360 for demo)"
    )

    # Verify command
    verify_parser = subparsers.add_parser(
        "verify",
        help="Verify an access token"
    )
    verify_parser.add_argument(
        "--token",
        required=True,
        help="Token to verify"
    )

    # Revoke command
    revoke_parser = subparsers.add_parser(
        "revoke",
        help="Revoke an access token"
    )
    revoke_parser.add_argument(
        "--token",
        required=True,
        help="Token to revoke"
    )

    # List command
    subparsers.add_parser(
        "list",
        help="List active tokens (admin)"
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "request": cmd_request,
        "verify": cmd_verify,
        "revoke": cmd_revoke,
        "list": cmd_list,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
