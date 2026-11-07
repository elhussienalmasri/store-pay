use crate::errors::EscrowError;
use crate::state::Escrow;
use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
        TransferChecked,
    },
};

/// Same-mint counterpart of `Take`.
///
/// `Take` lists `taker_ata_a` and `taker_ata_b` separately. When an escrow uses
/// the same mint on both sides (WSOL/WSOL), those two fields resolve to the same
/// token account, and Anchor rejects the instruction with
/// `ConstraintDuplicateMutableAccount` (2040). This instruction takes the mint
/// once, so every account appears exactly once.
#[derive(Accounts)]
pub struct TakeSameMint<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,
    #[account(mut)]
    pub maker: SystemAccount<'info>,
    #[account(
        mut,
        close = maker,
        seeds = [b"escrow", maker.key().as_ref(), escrow.seed.to_le_bytes().as_ref()],
        bump = escrow.bump,
        has_one = maker @ EscrowError::InvalidMaker,
    )]
    pub escrow: Box<Account<'info, Escrow>>,

    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = escrow,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = mint,
        associated_token::authority = taker,
        associated_token::token_program = token_program,
    )]
    pub taker_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = mint,
        associated_token::authority = maker,
        associated_token::token_program = token_program,
    )]
    pub maker_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> TakeSameMint<'info> {
    fn transfer_to_maker(&mut self) -> Result<()> {
        transfer_checked(
            CpiContext::new(
                self.token_program.key(),
                TransferChecked {
                    from: self.taker_ata.to_account_info(),
                    to: self.maker_ata.to_account_info(),
                    mint: self.mint.to_account_info(),
                    authority: self.taker.to_account_info(),
                },
            ),
            self.escrow.receive,
            self.mint.decimals,
        )?;
        Ok(())
    }

    fn withdraw_and_close_vault(&mut self) -> Result<()> {
        let signer_seeds: [&[&[u8]]; 1] = [&[
            b"escrow",
            self.maker.to_account_info().key.as_ref(),
            &self.escrow.seed.to_le_bytes()[..],
            &[self.escrow.bump],
        ]];
        transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.key(),
                TransferChecked {
                    from: self.vault.to_account_info(),
                    to: self.taker_ata.to_account_info(),
                    mint: self.mint.to_account_info(),
                    authority: self.escrow.to_account_info(),
                },
                &signer_seeds,
            ),
            self.vault.amount,
            self.mint.decimals,
        )?;

        close_account(CpiContext::new_with_signer(
            self.token_program.key(),
            CloseAccount {
                account: self.vault.to_account_info(),
                authority: self.escrow.to_account_info(),
                destination: self.maker.to_account_info(),
            },
            &signer_seeds,
        ))?;
        Ok(())
    }
}

pub fn handler(ctx: Context<TakeSameMint>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.escrow.mint_a,
        ctx.accounts.escrow.mint_b,
        EscrowError::InvalidMintB
    );
    require_keys_eq!(
        ctx.accounts.vault.mint,
        ctx.accounts.escrow.mint_a,
        EscrowError::InvalidMintA
    );

    ctx.accounts.transfer_to_maker()?;
    ctx.accounts.withdraw_and_close_vault()?;
    Ok(())
}
