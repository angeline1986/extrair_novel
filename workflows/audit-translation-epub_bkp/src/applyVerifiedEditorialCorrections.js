#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import { applyApprovedPdfEpubFindings } from './applyPdfEpubApprovedFindings.js';
import { runPdfEpubComparisonReport } from './auditPdfEpubReport.js';

const corrections = [
  {
    from: 'Quando Doihyeon finalmente recuperou a consciência, seu genro já estava de bom humor. Encarei o teto monótono, porém elegante, e ergui a parte superior do corpo.',
    to: 'Quando Doihyeon finalmente recobrou os sentidos, o ambiente ao redor já estava claro. Ele encarou o teto monótono, porém elegante, e ergueu a parte superior do corpo.',
  },
  {
    from: 'Ao mesmo tempo, o genro ficou estranhamente quieto. Para exagerar um pouco, era como se desse para ouvir um alfinete cair.',
    to: 'Ao mesmo tempo, o ambiente ficou estranhamente silencioso. Para exagerar um pouco, era como se desse para ouvir um alfinete cair.',
  },
  {
    from: 'Sempre que tinha um sonho assim, Doihyeon acordava suando frio. Meu genro não conseguia voltar a dormir, mesmo estando escuro, então passou a noite se revirando na cama várias vezes.',
    to: 'Sempre que tinha um sonho assim, Doihyeon acordava suando frio. Ele não conseguia voltar a dormir, embora ainda estivesse escuro, e muitas vezes passava o restante da noite se revirando na cama.',
  },
  {
    from: 'Hahaha, eu estava mesmo tentando parar de fumar. Por que você está agindo de forma tão indecente? Hein?',
    to: 'Ah, eu realmente pretendia parar. Por que você está sendo tão provocante, hein?',
  },
  {
    from: 'Ou então não posso mais fazer isso porque não tenho camisinha. Devo parar de fumar?',
    to: 'Como não temos mais preservativos, não podemos continuar. Devemos parar?',
  },
  {
    from: 'Não tenho nada para fazer, então posso fumar até tarde.',
    to: 'Você não tem nada para fazer, então pode ficar descansando.',
  },
  {
    from: 'Não vou parar de fumar quando ficar excitado?',
    to: 'Será que ele não desistiria se perdesse a paciência?',
  },
  {
    from: 'Tem certeza de que quer parar de fumar?',
    to: 'Tem certeza de que quer parar?',
  },
  {
    entry: 'chapter_004.xhtml',
    from: 'O problema era que o pênis do Doihyeon estava ereto. Eu tenho sonhos eróticos desde o ensino fundamental e médio, mas comecei a tê-los aos 30 anos. Foi constrangedor.',
    to: 'O problema era que o pênis de Doihyeon continuava ereto. Ele quase nunca tivera sonhos eróticos, nem mesmo na adolescência, mas agora começava a tê-los depois dos 30 anos. Era constrangedor.',
  },
  ...[
    ['Após demitir Kim Yu-min,', 'Após se despedir de Kim Yu-min,'],
    ['levantou-se cuidadosamente de sua carteira.', 'levantou-se cuidadosamente de sua mesa.'],
    ['“Professor, vou te enviar o material', '“Sênior, vou te enviar o material'],
    ['Eu te chamei de mais velho?', 'Eu te chamei de Sênior?'],
    ['Quando Do Yi-hyeon era estudante universitária, ele', 'Quando Do Yi-hyeon era estudante universitário, ele'],
    ['“Cavalgue ao meu lado.”', '“Suba aqui comigo.”'],
    ['fingir que se dava bem com ele e demiti-lo.', 'fingir que se dava bem com ele e depois deixá-lo.'],
    ['Seo Jeongwoon só vai me fazer sentir dor de boca.', 'Seo Jeongwoon só vai me dar dor de cabeça.'],
    ['minha boca subitamente ficou entediada.', 'de repente, senti vontade de comer alguma coisa.'],
    ['Doihyeon apertou o sexo oposto ainda mais forte.', 'Doihyeon apertou as coxas ainda mais forte.'],
    ['trazido um homem tão idoso até Busan.', 'trazido um homem de cargo tão alto até Busan.'],
    ['Então, o que estou cortando agora...', 'Então, por que estou segurando isso agora...'],
    ['Como diabos eu acabei cortando a coxa', 'Como diabos eu acabei agarrado à coxa'],
    ['“Estou grávida.”', '“Estou grávido.”'],
    ['¡Cuadang!', 'Bum!'],
    ['“Guardião, por favor, tenha cuidado. Esta é a sala de emergência.”', '“Acompanhante, por favor, tenha cuidado. Esta é a sala de emergência.”'],
    ['ele pareceu irritado por estar grávida.', 'ele pareceu irritado por Doihyeon estar grávido.'],
    ['Este aplicativo é mesmo meu?', 'Este bebê é mesmo meu?'],
  ].map(([from, to]) => ({ entry: 'chapter_005.xhtml', from, to })),
  ...[
    ['Seo Jeongwoon pisoteou a boca de Doihyeon sem hesitar.', 'Seo Jeongwoon tomou a boca de Doihyeon sem hesitar.'],
    ['Senti uma sensação estranha e sexual que me arrepiou.', 'Ele sentiu uma sensação estranha e sexual que o arrepiou.'],
    ['Fazia muito tempo que eu não me sentia tão excitada.', 'Fazia muito tempo que ele não se sentia tão excitado.'],
    ['O baixo ventre de Seo Jeongwoon revirou', 'O baixo ventre de Seo Jeongwoon se contraiu'],
    ['lábios vermelhos e boca solta, não sabe o quão obsceno ele é?', 'lábios vermelhos e boca entreaberta, não sabe o quão provocante ele é?'],
    ['Ou que me aperte?', 'Ou que te aperte?'],
    ['Seo Jeongwoon esfaqueou Do Yi-hyeon.', 'Seo Jeongwoon penetrou Do Yi-hyeon.'],
    ['esmagou os ossos de suas asas com as palmas das mãos.', 'pressionou as escápulas dele com as palmas das mãos.'],
    ['Quem está pisoteando seu eu interior agora?', 'Quem está dominando o seu interior agora?'],
  ].map(([from, to]) => ({ entry: 'chapter_006.xhtml', from, to })),
  ...[
    ['"Eu não parecia beber muito."', '"Parece que eu não bebi tanto assim."'],
    ['fiquei sem ideias, então tentei mais algumas vezes.', 'fiquei sem saber o que fazer, então tentei mais algumas vezes.'],
    ['“Sr. Lee Hyun, então o senhor se esqueceu do soco?”', '“Sr. Lee Hyun, então o senhor se esqueceu do cio?”'],
    ['mesmo durante o golpe', 'mesmo durante o cio'],
    ['golpe realizado com Seo Jeongwoon era "a primeira série".', 'cio que passou com Seo Jeongwoon foi o seu primeiro cio acompanhado.'],
    ['nunca havia chutado ninguém antes.', 'nunca havia levado um fora antes.'],
    ['Em casos graves, isso pode até desencadear um jogo.', 'Em casos graves, isso pode até desencadear um cio.'],
    ['aproximou-se de Batou e envolveu a cintura de Doihyeon', 'aproximou-se rapidamente e envolveu a cintura de Doihyeon'],
    ['“Lee Hyun, ouvi dizer que estou com pouco feromônio.', '“Lee Hyun, ouvi dizer que meus níveis de feromônio estão baixos.'],
  ].map(([from, to]) => ({ entry: 'chapter_007.xhtml', from, to })),
  ...[
    ['uma leve vibração era transmitida ao seu pescoço cada vez que ele chorava.', 'uma leve vibração era transmitida ao seu pescoço cada vez que ele falava.'],
    ['Por que diabos eles estão fazendo isso?', 'Por que diabos ele está fazendo isso?'],
    ['Seo Jeongun apontou para o barco de Doihyeon.', 'Seo Jeongwoon apontou para a barriga de Doihyeon.'],
    ['direito de entrevistar e negociar com um bebê', 'direito de visita e negociação a respeito do bebê'],
  ].map(([from, to]) => ({ entry: 'chapter_008.xhtml', from, to })),
  ...[
    ['“Minha boca está entediada.”', '“Estou com vontade de beliscar alguma coisa.”'],
    ['fazia um tempo que eu não ia ao banheiro, então não conseguia encontrar nada.', 'fazia algum tempo que eu não ia à despensa, então não conseguia encontrar nada para comer.'],
    ['enquanto segurava o celular', 'enquanto olhava o celular'],
    ['Quanta atenção você dedicou à decoração hoje? Beleza não é brincadeira.', 'Como você se produziu hoje, hein? Está bonito de verdade.'],
    ['Graças à decoração cuidadosa,', 'Graças ao visual impecável,'],
    ['Doihyeon o encarou por alguns segundos e então subiu na mesa.', 'Doihyeon o encarou por alguns segundos e então se levantou, apoiando-se na mesa.'],
    ['“Mido 188 cm”.', '“Tenho 1,88 m de altura.”'],
    ['Você dá um barco de presente para o seu chefe no escritório dele.', 'Você dá uma barriga de presente para o seu chefe no escritório dele.'],
    ['Doihyeon olhou para o navio confuso.', 'Doihyeon olhou para a barriga, confuso.'],
    ['“¿Está seguro?”', '“Tem certeza?”'],
  ].map(([from, to]) => ({ entry: 'chapter_009.xhtml', from, to })),
  ...[
    ['Doihyeon havia se demitido do emprego', 'Doihyeon havia decidido se afastar dele'],
    ['demiti-lo unilateralmente agora?', 'cortar relações com ele unilateralmente agora?'],
    ['colega de classe com quem ele nem tinha intimidade.', 'colega com quem ele nem tinha intimidade.'],
    ['não estar mais casada com Seo Jeongwoon', 'não ter nada sério com Seo Jeongwoon'],
    ['É importante que Lee Hyun se sinta desconfortável.', 'O importante é que Lee Hyun se sinta confortável.'],
    ['golpear o braço de Seo Jeongwoon', 'afastar o braço de Seo Jeongwoon'],
    ['“Si me llamas Jeongwoon”.', '“Se você me chamar de Jeongwoon...”'],
    ['“Finalmente estão me ligando.”', '“Finalmente você está me chamando pelo nome.”'],
    ['mensagem de parabéns', 'provocação'],
    [
      'Fiquei bastante envergonhado porque nunca imaginei que Seo Jeongwoon me deixaria sozinho e iria para outro lugar.',
      'Fiquei bastante envergonhado, pois nunca imaginei que Seo Jeongwoon me deixaria sozinho e iria para outro lugar.',
    ],
    [
      'Doihyeon continuou olhando ao redor e remexendo nos bolsos, com a expressão rígida. O que mais o frustrava era não conseguir dizer se Seo Jeongwoon não estava lá ou se simplesmente não conseguia encontrá-lo.',
      'Doihyeon continuou olhando ao redor e tateando os bolsos, com a expressão tensa. O que mais o frustrava era não saber se Seo Jeongwoon tinha ido embora ou se ele simplesmente não conseguia encontrá-lo.',
    ],
    [
      '“Ah, você está procurando um guarda?” “Ele foi para o depósito.”',
      '— Ah, está procurando o seu acompanhante? Ele foi ao guarda-volumes.',
    ],
  ].map(([from, to]) => ({ entry: 'chapter_010.xhtml', from, to })),
  {
    entry: 'chapter_011.xhtml',
    from: '“Você também sabe disso, professora.”',
    to: '“O senhor também sabe disso, doutor.”',
  },
  ...[
    ['"Por que você é tão linda, Lee Hyun?"', '"Por que você é tão lindo, Lee Hyun?"'],
    ['me dizendo para ligar para ele de novo.', 'me pedindo para chamá-lo pelo nome de novo.'],
  ].map(([from, to]) => ({ entry: 'chapter_013.xhtml', from, to })),
  {
    entry: 'chapter_014.xhtml',
    from: '“Eu vou primeiro. Se cuida, irmão. “Eu jogo de novo, irmão.”',
    to: '“Já vou indo. Cuide-se, irmão. A gente se fala.”',
  },
  ...[
    [
      'Além disso, minha garganta estava ardendo. Doihyeon me obrigou a levantar e me deu água gelada. Mas a sede persistente não passou.',
      'Além disso, sua garganta estava ardendo. Doihyeon se forçou a levantar e bebeu água gelada. Mas a sede persistente não passava.',
    ],
    [
      'Não acredito que fizeram tanto alvoroço hoje de manhã por causa de uma melancia. Me senti como se estivesse possuído por alguma coisa.',
      'Não acredito que fiz tanto alvoroço hoje de manhã por causa de uma melancia. Eu me senti como se estivesse possuído por alguma coisa.',
    ],
    ['nenhum problema foi encontrado durante a inspeção.', 'nenhum problema foi encontrado durante o exame.'],
    ['Onde estava o CEO durante a inspeção?', 'Onde o CEO estava durante o exame?'],
    ['—Doihyeon, vamos começar a inspeção agora.', '— Doihyeon, vamos começar o exame agora.'],
    ['acabou com um dos braços quebrados.', 'acabou com um dos braços imobilizados.'],
    ['o braço do Doihyeon, que ele mal conseguia segurar, quebrou.', 'o braço de Doihyeon, que ele mal conseguia mover, ficou preso.'],
    ['De repente, caí sentada no chão.', 'De repente, caí sentado no chão.'],
    ['"Ah, Irmã Lee Hyeon. Irmã Lee Hyeon".', '"Ah, Irmão Lee Hyeon. Irmão Lee Hyeon".'],
    [
      'Doihyeon ergueu uma sobrancelha. Faz apenas três ou quatro horas que eu caí.',
      'Doihyeon ergueu uma sobrancelha. Fazia apenas três ou quatro horas que ele havia desmaiado.',
    ],
    ['Seo Jeongwoon deu um tapa no pescoço, satisfeito.', 'Seo Jeongwoon beijou seu pescoço, satisfeito.'],
    [
      '“Sim, Lee Hyun, tem muita água, então você precisa ter cuidado.”',
      '“Sim, Lee Hyun, o chão está molhado, então você precisa ter cuidado.”',
    ],
  ].map(([from, to]) => ({ entry: 'chapter_015.xhtml', from, to })),
  ...[
    ['Quem é você a esta hora?', 'Quem é você para chegar a esta hora?'],
    ['Seo Jeongwoon se aproximou de Batou um após o outro', 'Seo Jeongwoon se aproximou rapidamente'],
    ['Minha mãe disse que gostaria de ver isso.', 'Minha mãe disse que gostaria de ver você.'],
    [
      'desejava preencher Hana completamente com sua família.',
      'desejava ver sua família completa.',
    ],
    ['Seo Jeongwoon quebrou o nariz e esfregou os lábios', 'Seo Jeongwoon enterrou o nariz e esfregou os lábios'],
    ['Seo Jeongwoon ainda parecia não ter vontade de sair comigo.', 'Seo Jeongwoon ainda parecia não ter vontade de me deixar sair.'],
    [
      'Depois de beber tudo, você deve guardar. Por quê? Você quer ter por perto?',
      'Quando tudo acabar, você deve descansar. Por quê? Você quer que eu fique por perto?',
    ],
  ].map(([from, to]) => ({ entry: 'chapter_016.xhtml', from, to })),
  ...[
    [
      'Doihyun assentiu calmamente. Não era como se ele estivesse tentando me enganar, então não hesitei. Era óbvio que, se o salário aumentasse de qualquer forma, o fato de eu ser um Ômega se espalharia por toda a empresa.',
      'Doihyeon assentiu calmamente. Como não estava tentando esconder nada, não hesitou. Era óbvio que, se o salário aumentasse de qualquer forma, o fato de ele ser um Ômega se espalharia por toda a empresa.',
    ],
    ['Alguém está montando.', 'Alguém está vigiando.'],
    ['Estou pendurada assim, quando você vai cuidar de mim?', 'Estou esperando assim, quando você vai cuidar de mim?'],
    ['Motivação de Taejun Lee', 'A intenção de Taejun Lee'],
    ['seus longos dedos destrancaram as calças de Doihyun.', 'seus longos dedos desabotoaram as calças de Doihyeon.'],
    ['Você realmente o odeia?', 'Você realmente odeia isso?'],
    ['Seo Jeongwoon apoiou o peso em um dos ombros de Doihyeon e abaixou a cintura', 'Seo Jeongwoon apoiou o peso em um dos ombros de Doihyeon e inclinou o corpo'],
  ].map(([from, to]) => ({ entry: 'chapter_017.xhtml', from, to })),
  ...[
    [
      'Após piscar por um instante, ele percebeu que estava deitado sobre o peito de Seo Jeongwoon com os braços decepados. Em resumo, dizia-se que ele dormia com Seo Jeongwoon meio despedaçado.',
      'Após piscar por um instante, ele percebeu que estava deitado sobre o peito de Seo Jeongwoon, com os braços entrelaçados. Em resumo, dormia com o corpo envolvido pelo de Seo Jeongwoon.',
    ],
    ['Enquanto eu estava ocupada trabalhando, o tempo voou.', 'Enquanto eu estava ocupado trabalhando, o tempo voou.'],
    ['Motivação de Taejun Lee', 'A intenção de Taejun Lee'],
    [
      'Seo Jeongwoon expressou seu descontentamento, mas Do Yi-hyeon o cortou como uma faca.',
      'Seo Jeongwoon expressou seu descontentamento, mas Do Yi-hyeon respondeu de forma cortante.',
    ],
  ].map(([from, to]) => ({ entry: 'chapter_018.xhtml', from, to })),
  ...[
    ['Doihyeon gaguejou e abaixou a cintura.', 'Doihyeon gaguejou e inclinou o corpo.'],
    ['Seo Jeongwoon ofereceu o pescoço e baixou a cintura', 'Seo Jeongwoon ofereceu o pescoço e inclinou o corpo'],
  ].map(([from, to]) => ({ entry: 'chapter_019.xhtml', from, to })),
  ...[
    ['“Isto não é o Alpha impresso, o que é isto…”', '“Se isso não é uma marca de Alfa, então o que é...?”'],
    ['“É uma gravura.”', '“É uma marca.”'],
    ['“Será que gravar é mesmo tão fácil assim?”', '“Será que a marcação é mesmo tão fácil assim?”'],
    ['Ninguém sabe como a gravura é feita.', 'Ninguém sabe como a marcação acontece.'],
    ["'… … 'Devo me demitir agora?'", "'... Devo pedir demissão agora?'"],
    [
      'Quando descobri o lado da pessoa de quem eu sentia tanta falta, liguei para ele sem nem perceber.',
      'Quando percebeu o quanto sentia falta daquela pessoa, chamou por ele sem nem notar.',
    ],
    ['‘¿Me amas? ‘¿Seo Jeongwoon?’', '‘Você me ama, Seo Jeongwoon?’'],
    ['“Já joguei tudo ao mar, Sr. Lee Hyeon.”', '“Eu já abri mão de tudo, Sr. Lee Hyun.”'],
    ['Saiganman, que já havia se tocado inúmeras vezes,', 'Aquele homem, que já havia se contido inúmeras vezes,'],
    [
      'Ele repreendeu Doihyeon carinhosamente e depois mordeu o próprio nariz para aliviar a dor.',
      'Ele repreendeu Doihyeon carinhosamente e depois roçou o nariz no dele para aliviar a tensão.',
    ],
    [
      'A situação está muito apertada. Se eu continuar fazendo isso, serei demitido.',
      'A situação está ficando intensa demais. Se continuarmos, vou perder o controle.',
    ],
    [
      'Pare de me provocar. Acho que se eu adicionar mais alguma coisa aqui, vou alcançar as notas.',
      'Pare de me provocar. Se continuar assim, vou chegar ao meu limite agora mesmo.',
    ],
  ].map(([from, to]) => ({ entry: 'chapter_021.xhtml', from, to })),
  ...[
    ['maestro.', 'doutor.'],
    [
      'Seo Jeongwoon, ainda insatisfeito, saiu com um quadro branco em branco e olhou para Do Yi-hyeon.',
      'Seo Jeongwoon, ainda insatisfeito, saiu com uma expressão vazia e olhou para Do Yi-hyeon.',
    ],
    ['depois a pegou no colo e a vestiu com um pijama colorido.', 'depois o pegou no colo e o vestiu com um pijama colorido.'],
    ['levarei Jeongwoon com você.', 'levarei Jeongwoon comigo.'],
    [
      'Seo Jeongwoon fez uma cara fechada, mas Do Yi-hyeon a desvendou como uma faca.',
      'Seo Jeongwoon fez uma cara fechada, mas Do Yi-hyeon respondeu de forma cortante.',
    ],
    ['Tente me ligar novamente.', 'Tente me chamar pelo nome novamente.'],
    ['Você acha que eu vou me safar se fizer isso?', 'Você acha que vou deixar você escapar se fizer isso?'],
    ['Por que você não me contou sobre Dodam?', 'Por que você não me contou sobre o Dodam?'],
  ].map(([from, to]) => ({ entry: 'chapter_022.xhtml', from, to })),
];

export async function applyVerifiedEditorialCorrections() {
  const report = await applyApprovedPdfEpubFindings({ manualReplacements: corrections });
  const reportPath = await runPdfEpubComparisonReport();
  return { report, reportPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  applyVerifiedEditorialCorrections()
    .then(({ report, reportPath }) => {
      console.log(report.noOp ? report.message : report.finalPath);
      console.log(`Relatorio atualizado: ${reportPath}`);
    })
    .catch((error) => {
      console.error(`Erro ao aplicar correcoes editoriais verificadas: ${error.message}`);
      process.exit(1);
    });
}
