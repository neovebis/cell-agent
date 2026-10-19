from playwright.sync_api import sync_playwright
from pathlib import Path
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    page.set_content(Path(__file__).parents[1].joinpath('index-preview.html').read_text(encoding='utf-8'), wait_until='load')
    assert page.locator('.avatar img').first.evaluate('(img) => img.complete && img.naturalWidth === 1536 && img.naturalHeight === 1536'), 'Original logo failed to load'
    assert page.locator('.avatar svg').count() == 0, 'Recreated logo SVG still present'
    assert page.get_by_text('Agentes',exact=True).count()==1
    page.screenshot(path=str(Path(__file__).parents[1].joinpath('preview-agents.png')))
    assert page.get_by_text('Eliot',exact=True).count()==1
    page.get_by_role('button',name='Criar agente').click()
    page.locator('#new-name').fill('Griot Teste')
    page.locator('#new-desc').fill('Agente de testes')
    page.get_by_role('button',name='Criar agente',exact=True).last.click()
    assert page.get_by_text('Griot Teste',exact=True).count()>=1
    page.screenshot(path=str(Path(__file__).parents[1].joinpath('preview-chat.png')))
    page.locator('#compose-input').fill('Olá, Griot!')
    page.get_by_role('button',name='Enviar').click()
    assert page.get_by_text('Olá, Griot!').count()>=1
    page.get_by_role('button',name='Voltar').click()
    page.get_by_role('button',name='Capture').click()
    assert page.get_by_role('button',name='Capturar').count()==1
    page.screenshot(path=str(Path(__file__).parents[1].joinpath('preview-capture.png')))
    page.get_by_role('button',name='Capturar').click()
    page.get_by_role('button',name='Texto').click()
    page.locator('#capture-text').fill('Notas do meu projeto')
    page.get_by_role('button',name='Guardar na biblioteca').click()
    assert page.get_by_text('Notas do meu projeto').count()==1
    page.get_by_role('button',name='Conectores').click()
    assert page.get_by_text('Google Drive').count()==1
    page.get_by_role('button',name='Skills',exact=True).click()
    assert page.get_by_text('Análise de dados').count()==1
    page.get_by_role('button',name='Atividade').click()
    assert page.get_by_text('Sem atividade para apresentar.').count()==1
    page.get_by_role('button',name='Perfil').click()
    page.get_by_role('button',name='Definições').click()
    assert page.get_by_text('Notificações',exact=True).count()>=1
    print('PASS: navegação, criar agente, chat, Capture texto, conectores, atividade, perfil e definições.')
    browser.close()
