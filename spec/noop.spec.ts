describe( 'nothing', () => {
  it( 'does nothing', async () => {
    expect( await Promise.resolve( 3 ** 3 ) ).toBe( 27 );
  } );
} );
